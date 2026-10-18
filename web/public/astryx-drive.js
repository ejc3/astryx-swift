/*
 * The in-page web driver. Plain browser JavaScript: no build step, no imports. Vite copies it
 * as it is into dist/, and the native app injects it into its web views.
 *
 *   window.__astryxDrive.resolve(target)   the element a recorded locator chain names, or null
 *   window.__astryxDrive.perform(gestures) do recorded gestures in the page, as a person would
 *
 * A target is a chain of locator links (see LocatorOp in core/src/scenarios.ts), resolved the
 * way Playwright resolves a chained locator: each link searches inside the previous link's
 * matches, and only visible elements match. A gesture is performed with real DOM events (the
 * pointer, mouse, key and input events a browser sends), so React sees what it would see from
 * a person.
 *
 * Name and role rules follow Playwright's (and so the accessible name computation of the ARIA
 * specification, as browsers implement it): implicit roles of HTML elements, aria-labelledby,
 * aria-label, native labels, alt text, name from content, title, placeholder.
 *
 * A name or text that is a regular expression is a string of the form "/source/flags".
 */
(function () {
  "use strict";
  if (window.__astryxDrive) return;

  /** @typedef {{ by: "role", role: string, name?: string, exact?: boolean }
   *   | { by: "label", text: string, exact?: boolean }
   *   | { by: "text", text: string, exact?: boolean }
   *   | { by: "placeholder", text: string, exact?: boolean }
   *   | { by: "css", selector: string }
   *   | { by: "nth", index: number }} LocatorOp */
  /** @typedef {{ kind: "click" } | { kind: "fill", text: string } | { kind: "check" } | { kind: "uncheck" }
   *   | { kind: "select", value: string } | { kind: "press", key: string } | { kind: "hover" }} Gesture */

  // ---------------------------------------------------------------- text helpers

  const normalize = (s) => s.replace(/[\u200b\u00ad]/g, "").trim().replace(/\s+/g, " ");
  /** Accessible-name flattening: runs of whitespace become one space, non-breaking spaces stay. */
  const flat = (s) =>
    s.split("\u00a0").map((chunk) => chunk.replace(/\r\n/g, "\n").replace(/[\u200b\u00ad]/g, "").replace(/\s\s*/g, " ")).join("\u00a0").trim();
  const tagOf = (el) => (el.localName || "").toUpperCase();

  /** "/source/flags" -> RegExp (without g and y, so tests carry no state); anything else -> null. */
  function asRegExp(text) {
    const m = /^\/([\s\S]+)\/([dimsuv]*)$/.exec(text);
    if (!m) return null;
    try {
      return new RegExp(m[1], m[2]);
    } catch {
      return null;
    }
  }

  /** A name matcher: regular expression, else exact (case-sensitive, equal) or substring (case-insensitive). */
  function matcherFor(text, exact) {
    const re = asRegExp(text);
    if (re) return (actual) => re.test(actual);
    const wanted = normalize(text);
    if (exact) return (actual) => actual === wanted;
    const lower = wanted.toLowerCase();
    return (actual) => actual.toLowerCase().includes(lower);
  }

  // ---------------------------------------------------------------- caches (one resolve)

  let hiddenCache = null;
  let roleCache = null;
  let nameCache = null;
  let textCache = null;
  function beginCaches() {
    hiddenCache = new Map();
    roleCache = new Map();
    nameCache = new Map();
    textCache = new Map();
  }
  function endCaches() {
    hiddenCache = roleCache = nameCache = textCache = null;
  }
  function cached(map, key, make) {
    if (!map) return make();
    if (map.has(key)) return map.get(key);
    const value = make();
    map.set(key, value);
    return value;
  }

  // ---------------------------------------------------------------- visibility

  const IGNORED_TAGS = new Set(["STYLE", "SCRIPT", "NOSCRIPT", "TEMPLATE"]);

  /** Non-empty bounding box and not visibility:hidden. */
  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.visibility !== "collapse";
  }

  function belongsToHiddenSubtree(el) {
    return cached(hiddenCache, el, () => {
      const style = getComputedStyle(el);
      let hidden = style.display === "none" || (el.getAttribute("aria-hidden") || "").toLowerCase() === "true";
      if (!hidden && el.parentElement) hidden = belongsToHiddenSubtree(el.parentElement);
      return hidden;
    });
  }

  /** Hidden from the accessibility tree: what a role locator leaves out. */
  function isHiddenForAria(el) {
    if (IGNORED_TAGS.has(tagOf(el))) return true;
    const style = getComputedStyle(el);
    if (style.display === "contents") {
      for (let c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 1 && !isHiddenForAria(c)) return false;
        if (c.nodeType === 3 && /\S/.test(c.nodeValue || "")) return false;
      }
      return true;
    }
    const insideSelect = tagOf(el) === "OPTION" && !!el.closest("select");
    if (!insideSelect && style.visibility !== "visible") return true;
    return belongsToHiddenSubtree(el);
  }

  // ---------------------------------------------------------------- roles

  const VALID_ROLES = new Set(
    ("alert alertdialog application article banner blockquote button caption cell checkbox code columnheader combobox " +
      "complementary contentinfo definition deletion dialog directory document emphasis feed figure form generic grid " +
      "gridcell group heading img insertion link list listbox listitem log main marquee math meter menu menubar menuitem " +
      "menuitemcheckbox menuitemradio navigation none note option paragraph presentation progressbar radio radiogroup " +
      "region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong subscript " +
      "superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem").split(" "),
  );

  const INPUT_ROLES = {
    button: "button", checkbox: "checkbox", image: "button", number: "spinbutton", radio: "radio", range: "slider",
    reset: "button", submit: "button",
  };

  const LANDMARK_BLOCKERS = "article,aside,main,nav,section,[role=article],[role=complementary],[role=main],[role=navigation],[role=region]";

  const hasName = (el) => !!(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title"));

  /** The role an HTML element has with no role attribute. */
  function implicitRole(el) {
    switch (tagOf(el)) {
      case "A": case "AREA": return el.hasAttribute("href") ? "link" : null;
      case "ARTICLE": return "article";
      case "ASIDE": return "complementary";
      case "BLOCKQUOTE": return "blockquote";
      case "BUTTON": return "button";
      case "CAPTION": return "caption";
      case "CODE": return "code";
      case "DATALIST": return "listbox";
      case "DD": return "definition";
      case "DEL": return "deletion";
      case "DETAILS": return "group";
      case "DFN": case "DT": return "term";
      case "DIALOG": return "dialog";
      case "EM": return "emphasis";
      case "FIELDSET": return "group";
      case "FIGURE": return "figure";
      case "FOOTER": return el.closest(LANDMARK_BLOCKERS) ? null : "contentinfo";
      case "FORM": return hasName(el) ? "form" : null;
      case "H1": case "H2": case "H3": case "H4": case "H5": case "H6": return "heading";
      case "HEADER": return el.closest(LANDMARK_BLOCKERS) ? null : "banner";
      case "HR": return "separator";
      case "IMG": return el.getAttribute("alt") === "" && !el.getAttribute("title") ? "presentation" : "img";
      case "INPUT": {
        const type = (el.type || "").toLowerCase();
        if (["email", "search", "tel", "text", "url", ""].includes(type)) {
          const list = el.getAttribute("list") && document.getElementById(el.getAttribute("list"));
          if (list && tagOf(list) === "DATALIST") return "combobox";
          return type === "search" ? "searchbox" : "textbox";
        }
        if (type === "hidden") return null;
        if (type === "file") return "button";
        return INPUT_ROLES[type] || "textbox";
      }
      case "INS": return "insertion";
      case "LI": return "listitem";
      case "MAIN": return "main";
      case "MARK": return "mark";
      case "MENU": case "OL": case "UL": return "list";
      case "METER": return "meter";
      case "NAV": return "navigation";
      case "OPTGROUP": return "group";
      case "OPTION": return "option";
      case "OUTPUT": return "status";
      case "P": return "paragraph";
      case "PROGRESS": return "progressbar";
      case "SEARCH": return "search";
      case "SECTION": return hasName(el) ? "region" : null;
      case "SELECT": return el.hasAttribute("multiple") || el.size > 1 ? "listbox" : "combobox";
      case "STRONG": return "strong";
      case "SUB": return "subscript";
      case "SUP": return "superscript";
      case "SVG": return "img";
      case "TABLE": return "table";
      case "TBODY": case "TFOOT": case "THEAD": return "rowgroup";
      case "TD": {
        const table = el.closest("table");
        const role = table ? explicitRole(table) : null;
        return role === "grid" || role === "treegrid" ? "gridcell" : "cell";
      }
      case "TEXTAREA": return "textbox";
      case "TH": {
        const scope = el.getAttribute("scope");
        if (scope === "col" || scope === "colgroup") return "columnheader";
        if (scope === "row" || scope === "rowgroup") return "rowheader";
        return "columnheader";
      }
      case "TIME": return "time";
      case "TR": return "row";
      default: return null;
    }
  }

  function explicitRole(el) {
    return (el.getAttribute("role") || "").split(" ").map((r) => r.trim()).find((r) => VALID_ROLES.has(r)) || null;
  }

  const FOCUSABLE = 'a[href],area[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex],[contenteditable=""],[contenteditable="true"]';
  const isFocusable = (el) => el.matches(FOCUSABLE) && !el.disabled;

  function roleOf(el) {
    return cached(roleCache, el, () => {
      const explicit = explicitRole(el);
      if (!explicit) return implicitRole(el);
      if ((explicit === "none" || explicit === "presentation") && isFocusable(el)) return implicitRole(el);
      return explicit;
    });
  }

  // ---------------------------------------------------------------- accessible names

  const NAME_FROM_CONTENT = new Set(
    "button cell checkbox columnheader gridcell heading link menuitem menuitemcheckbox menuitemradio option radio row rowheader switch tab tooltip treeitem".split(" "),
  );
  const DESCENDANT_NAME_FROM_CONTENT = new Set(
    ["", "caption", "code", "contentinfo", "definition", "deletion", "emphasis", "insertion", "list", "listitem", "mark", "none",
      "paragraph", "presentation", "region", "row", "rowgroup", "section", "strong", "subscript", "superscript", "table", "term", "time"],
  );
  const NAMELESS_ROLES = new Set(
    ["caption", "code", "definition", "deletion", "emphasis", "generic", "insertion", "mark", "paragraph", "presentation", "strong",
      "subscript", "suggestion", "superscript", "term", "time"],
  );

  function idRefs(el, ref) {
    if (!ref) return [];
    const root = el.getRootNode();
    const out = [];
    for (const id of ref.split(" ")) {
      if (!id) continue;
      const found = root.getElementById ? root.getElementById(id) : root.querySelector("#" + CSS.escape(id));
      if (found && !out.includes(found)) out.push(found);
    }
    return out;
  }

  function pseudoContent(el, pseudo) {
    const style = getComputedStyle(el, pseudo);
    const content = style.content;
    if (!content || content === "none" || content === "normal" || style.display === "none") return "";
    if (content.length >= 2 && content[0] === '"' && content[content.length - 1] === '"') return content.slice(1, -1);
    return "";
  }

  /**
   * The accessible name text of `el`, for a traversal described by `o`:
   * { visited, hiddenRef, inLabel, inLabelledBy, target: "self" | "descendant" | "none" }.
   */
  function altText(el, o) {
    if (o.visited.has(el)) return "";
    const child = { ...o, target: o.target === "self" ? "descendant" : o.target };
    if (!o.hiddenRef) {
      if (IGNORED_TAGS.has(tagOf(el)) || isHiddenForAria(el)) {
        o.visited.add(el);
        return "";
      }
    }
    const labelledBy = idRefs(el, el.getAttribute("aria-labelledby"));
    if (!o.inLabelledBy && labelledBy.length) {
      const text = labelledBy
        .map((ref) => altText(ref, { visited: o.visited, hiddenRef: isHiddenForAria(ref), inLabelledBy: true, inLabel: false, target: "none" }))
        .join(" ");
      if (text) return text;
    }
    const role = roleOf(el) || "";
    const tag = tagOf(el);
    if (o.inLabel || o.inLabelledBy || o.target === "descendant") {
      const ownLabel = el.labels ? [...el.labels].includes(el) : false;
      if (!ownLabel && !labelledBy.includes(el)) {
        if (role === "textbox" || role === "searchbox") {
          o.visited.add(el);
          return tag === "INPUT" || tag === "TEXTAREA" ? el.value : el.textContent || "";
        }
        if (role === "combobox" || role === "listbox") {
          o.visited.add(el);
          let selected = [];
          if (tag === "SELECT") {
            selected = [...el.selectedOptions];
            if (!selected.length && el.options.length) selected.push(el.options[0]);
          } else {
            const listbox = role === "combobox" ? [...el.querySelectorAll("*")].find((e) => roleOf(e) === "listbox") : el;
            selected = listbox ? [...listbox.querySelectorAll('[aria-selected="true"]')].filter((e) => roleOf(e) === "option") : [];
          }
          if (!selected.length && tag === "INPUT") return el.value;
          return selected.map((option) => altText(option, child)).join(" ");
        }
        if (["progressbar", "scrollbar", "slider", "spinbutton", "meter"].includes(role)) {
          o.visited.add(el);
          if (el.hasAttribute("aria-valuetext")) return el.getAttribute("aria-valuetext") || "";
          if (el.hasAttribute("aria-valuenow")) return el.getAttribute("aria-valuenow") || "";
          return el.getAttribute("value") || "";
        }
        if (role === "menu") {
          o.visited.add(el);
          return "";
        }
      }
    }
    const ariaLabel = el.getAttribute("aria-label") || "";
    if (ariaLabel.trim()) {
      o.visited.add(el);
      return ariaLabel;
    }
    const fromLabels = (labels) =>
      [...labels]
        .map((label) => altText(label, { visited: o.visited, hiddenRef: isHiddenForAria(label), inLabel: true, inLabelledBy: false, target: "none" }))
        .join(" ");
    if (role !== "presentation" && role !== "none") {
      if (tag === "INPUT" && ["button", "submit", "reset"].includes(el.type)) {
        o.visited.add(el);
        if ((el.value || "").trim()) return el.value;
        if (el.type === "submit") return "Submit";
        if (el.type === "reset") return "Reset";
        return el.getAttribute("title") || "";
      }
      if (tag === "INPUT" && el.type === "file") {
        o.visited.add(el);
        if (el.labels && el.labels.length && !o.inLabelledBy) return fromLabels(el.labels);
        return "Choose File";
      }
      if (tag === "INPUT" && el.type === "image") {
        o.visited.add(el);
        if (el.labels && el.labels.length && !o.inLabelledBy) return fromLabels(el.labels);
        if ((el.getAttribute("alt") || "").trim()) return el.getAttribute("alt");
        if ((el.getAttribute("title") || "").trim()) return el.getAttribute("title");
        return "Submit";
      }
      if (!labelledBy.length && (tag === "BUTTON" || tag === "OUTPUT")) {
        o.visited.add(el);
        if (el.labels && el.labels.length) return fromLabels(el.labels);
        if (tag === "OUTPUT") return el.getAttribute("title") || "";
      }
      if (!labelledBy.length && ["TEXTAREA", "SELECT", "INPUT", "METER", "PROGRESS"].includes(tag)) {
        o.visited.add(el);
        if (el.labels && el.labels.length) return fromLabels(el.labels);
        const usePlaceholder = (tag === "INPUT" && ["text", "password", "number", "search", "tel", "email", "url"].includes(el.type)) || tag === "TEXTAREA";
        const title = el.getAttribute("title") || "";
        if (!usePlaceholder || title) return title;
        return el.getAttribute("placeholder") || "";
      }
      const firstChildNamed = (childTag) => {
        for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
          if (tagOf(c) === childTag) return c;
        }
        return null;
      };
      const viaChild = (childTag) => {
        o.visited.add(el);
        const c = firstChildNamed(childTag);
        if (c) return altText(c, { ...child, hiddenRef: isHiddenForAria(c), inLabel: false, inLabelledBy: false });
        return el.getAttribute("title") || "";
      };
      if (!labelledBy.length && tag === "FIELDSET") return viaChild("LEGEND");
      if (!labelledBy.length && tag === "FIGURE") return viaChild("FIGCAPTION");
      if (tag === "IMG" || tag === "AREA") {
        o.visited.add(el);
        if ((el.getAttribute("alt") || "").trim()) return el.getAttribute("alt");
        return el.getAttribute("title") || "";
      }
      if (tag === "TABLE") {
        o.visited.add(el);
        const caption = firstChildNamed("CAPTION");
        if (caption) return altText(caption, { ...child, hiddenRef: isHiddenForAria(caption), inLabel: false, inLabelledBy: false });
        if (el.getAttribute("summary")) return el.getAttribute("summary");
      }
      if (tag === "SVG" || el.ownerSVGElement) {
        o.visited.add(el);
        for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
          if (tagOf(c) === "TITLE" && c.ownerSVGElement) return altText(c, { ...child, hiddenRef: isHiddenForAria(c), inLabelledBy: true });
        }
      }
    }
    const fromContent =
      NAME_FROM_CONTENT.has(role) ||
      (o.target === "descendant" && DESCENDANT_NAME_FROM_CONTENT.has(role)) ||
      (tag === "SUMMARY" && role !== "presentation" && role !== "none") ||
      o.inLabelledBy ||
      o.inLabel;
    if (fromContent) {
      o.visited.add(el);
      let text = pseudoContent(el, "::before");
      for (let n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 1) {
          const display = getComputedStyle(n).display || "inline";
          let token = altText(n, child);
          if (display !== "inline" || n.nodeName === "BR") token = " " + token + " ";
          text += token;
        } else if (n.nodeType === 3) {
          text += n.textContent || "";
        }
      }
      text += pseudoContent(el, "::after");
      if ((o.target === "self" ? text.trim() : text)) return text;
    }
    if (role !== "presentation" && role !== "none") {
      o.visited.add(el);
      const title = el.getAttribute("title") || "";
      if (title.trim()) return title;
    }
    o.visited.add(el);
    return "";
  }

  /** The accessible name of an element, whitespace flattened. */
  function nameOf(el) {
    return cached(nameCache, el, () => {
      if (NAMELESS_ROLES.has(roleOf(el) || "")) return "";
      return flat(altText(el, { visited: new Set(), hiddenRef: false, inLabel: false, inLabelledBy: false, target: "self" }));
    });
  }

  // ---------------------------------------------------------------- text and labels

  const skipForText = (el) => el.nodeName === "SCRIPT" || el.nodeName === "NOSCRIPT" || el.nodeName === "STYLE" || (document.head && document.head.contains(el));

  /** { full, normalized } text of an element, the way a text locator reads it. */
  function textOf(el) {
    return cached(textCache, el, () => {
      let value = { full: "", normalized: "" };
      if (skipForText(el)) {
        // nothing
      } else if (el instanceof HTMLInputElement && ["submit", "button", "reset"].includes(el.type)) {
        value = { full: el.value, normalized: normalize(el.value) };
      } else {
        let full = "";
        for (let c = el.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) full += c.nodeValue || "";
          else if (c.nodeType === 1) full += textOf(c).full;
        }
        value = { full, normalized: full ? normalize(full) : "" };
      }
      return value;
    });
  }

  /** A text matcher over { full, normalized }: a regular expression tests the full text. */
  function textMatcher(text, exact) {
    const re = asRegExp(text);
    if (re) return (t) => re.test(t.full);
    const wanted = normalize(text);
    if (exact) return (t) => t.normalized === wanted;
    const lower = wanted.toLowerCase();
    return (t) => t.normalized.toLowerCase().includes(lower);
  }

  function labelTexts(el) {
    const by = idRefs(el, el.getAttribute("aria-labelledby"));
    if (by.length) return by.map(textOf);
    const aria = el.getAttribute("aria-label");
    if (aria !== null && aria.trim()) return [{ full: aria, normalized: normalize(aria) }];
    const nativelyLabelled = ["BUTTON", "METER", "OUTPUT", "PROGRESS", "SELECT", "TEXTAREA"].includes(el.nodeName) || (el.nodeName === "INPUT" && el.type !== "hidden");
    if (nativelyLabelled && el.labels) return [...el.labels].map(textOf);
    return [];
  }

  // ---------------------------------------------------------------- locator chains

  /** What one link finds inside one scope root (not yet filtered for visibility). */
  function query(root, op) {
    switch (op.by) {
      case "role": {
        const wanted = op.role.toLowerCase();
        const match = op.name === undefined ? null : matcherFor(op.name, !!op.exact);
        const out = [];
        for (const el of root.querySelectorAll("*")) {
          if (roleOf(el) !== wanted) continue;
          if (isHiddenForAria(el)) continue;
          if (match && !match(nameOf(el))) continue;
          out.push(el);
        }
        return out;
      }
      case "label": {
        const match = textMatcher(op.text, !!op.exact);
        return [...root.querySelectorAll("*")].filter((el) => labelTexts(el).some(match));
      }
      case "text": {
        const match = textMatcher(op.text, !!op.exact);
        const out = [];
        const consider = (el) => {
          if (skipForText(el) || !match(textOf(el))) return;
          for (let c = el.firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 1 && match(textOf(c))) return;
          }
          out.push(el);
        };
        if (root.nodeType === 1) consider(root);
        for (const el of root.querySelectorAll("*")) consider(el);
        return out;
      }
      case "placeholder": {
        const re = asRegExp(op.text);
        const wanted = op.text;
        return [...root.querySelectorAll("[placeholder]")].filter((el) => {
          const value = el.getAttribute("placeholder") || "";
          if (re) return re.test(value);
          return op.exact ? value === wanted : value.toLowerCase().includes(wanted.toLowerCase());
        });
      }
      case "css":
        return [...root.querySelectorAll(op.selector)];
      default:
        throw new Error("astryx-drive: unknown locator link " + JSON.stringify(op));
    }
  }

  const byDocumentOrder = (a, b) => (a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

  /** Rendered, if not drawn: what a key press may go to (a resize handle can have an empty box). */
  function isRendered(el) {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse" && el.isConnected;
  }

  /** Every visible element a chain names, in document order. `loose` accepts rendered elements with an empty box. */
  function resolveAll(target, loose) {
    beginCaches();
    try {
      let scope = [document];
      for (const op of target) {
        if (op.by === "nth") {
          const i = op.index < 0 ? scope.length + op.index : op.index;
          scope = scope[i] ? [scope[i]] : [];
          continue;
        }
        const found = new Set();
        for (const root of scope) for (const el of query(root, op)) found.add(el);
        let list = [...found];
        if (scope.length > 1) list.sort(byDocumentOrder);
        scope = list.filter(loose ? isRendered : isVisible);
      }
      return scope;
    } finally {
      endCaches();
    }
  }

  /** @param {LocatorOp[]} target @returns {Element | null} the first match of the chain, if any. */
  function resolve(target) {
    return resolveAll(target)[0] || null;
  }

  function describeOp(op) {
    const q = (s) => JSON.stringify(s);
    switch (op.by) {
      case "role": return `getByRole(${q(op.role)}${op.name !== undefined ? `, { name: ${q(op.name)}${op.exact ? ", exact: true" : ""} }` : ""})`;
      case "label": return `getByLabel(${q(op.text)}${op.exact ? ", { exact: true }" : ""})`;
      case "text": return `getByText(${q(op.text)}${op.exact ? ", { exact: true }" : ""})`;
      case "placeholder": return `getByPlaceholder(${q(op.text)}${op.exact ? ", { exact: true }" : ""})`;
      case "css": return `locator(${q(op.selector)})`;
      case "nth": return op.index === 0 ? "first()" : op.index === -1 ? "last()" : `nth(${op.index})`;
      default: return JSON.stringify(op);
    }
  }
  const describe = (target) => target.map(describeOp).join(".");

  // ---------------------------------------------------------------- input modality

  // A browser draws a focus ring (and a library shows its keyboard hints) for :focus-visible,
  // and decides that from the real input that came before: after a mouse click, a script's
  // focus() draws no ring. Events a script sends are not real input, so after a driven click
  // the page's own focus() calls (a menu moving focus to its first item) would draw rings
  // nobody earned. While a driven gesture stands for a pointer, focus() calls that do not say
  // otherwise say focusVisible:false; any real key or pointer press hands the decision back
  // to the browser.
  let pointerMode = false;
  for (const type of ["keydown", "pointerdown", "mousedown"]) {
    window.addEventListener(type, (e) => { if (e.isTrusted) pointerMode = false; }, true);
  }
  for (const proto of [HTMLElement.prototype, SVGElement.prototype]) {
    const nativeFocus = proto.focus;
    proto.focus = function (options) {
      if (pointerMode && !(options && options.focusVisible !== undefined)) options = { ...options, focusVisible: false };
      return nativeFocus.call(this, options);
    };
  }

  // ---------------------------------------------------------------- events

  let hovered = null;

  function fire(el, Type, type, init) {
    const event = new Type(type, { bubbles: true, cancelable: true, composed: true, view: window, ...init });
    el.dispatchEvent(event);
    return event;
  }

  function mouseInit(point, button, buttons, detail) {
    return { clientX: point.x, clientY: point.y, screenX: point.x, screenY: point.y, button, buttons, detail: detail || 0 };
  }
  const pointerInit = (point, button, buttons) => ({
    ...mouseInit(point, button, buttons), pointerId: 1, pointerType: "mouse", isPrimary: true, width: 1, height: 1,
    pressure: buttons ? 0.5 : 0,
  });

  const pointerEvent = (el, type, point, button, buttons, extra) => fire(el, PointerEvent, type, { ...pointerInit(point, button, buttons), ...extra });
  const mouseEvent = (el, type, point, button, buttons, detail, extra) => fire(el, MouseEvent, type, { ...mouseInit(point, button, buttons, detail), ...extra });

  /** The pointer moves onto `el` (leaving what it was on), the way a browser reports it. */
  function movePointer(el, point) {
    const old = hovered && hovered.isConnected ? hovered : null;
    if (old !== el) {
      const nonBubbling = { bubbles: false };
      if (old) {
        pointerEvent(old, "pointerout", point, 0, 0, { relatedTarget: el });
        mouseEvent(old, "mouseout", point, 0, 0, 0, { relatedTarget: el });
        for (let n = old; n && !n.contains(el); n = n.parentElement) {
          pointerEvent(n, "pointerleave", point, 0, 0, { ...nonBubbling, relatedTarget: el });
          mouseEvent(n, "mouseleave", point, 0, 0, 0, { ...nonBubbling, relatedTarget: el });
        }
      }
      pointerEvent(el, "pointerover", point, 0, 0, { relatedTarget: old });
      mouseEvent(el, "mouseover", point, 0, 0, 0, { relatedTarget: old });
      const entered = [];
      for (let n = el; n && !(old && n.contains(old)); n = n.parentElement) entered.unshift(n);
      for (const n of entered) {
        pointerEvent(n, "pointerenter", point, 0, 0, { ...nonBubbling, relatedTarget: old });
        mouseEvent(n, "mouseenter", point, 0, 0, 0, { ...nonBubbling, relatedTarget: old });
      }
      hovered = el;
    }
    pointerEvent(el, "pointermove", point, 0, 0);
    mouseEvent(el, "mousemove", point, 0, 0, 0);
  }

  /** Where a person's pointer would land on `el`: its centre, and the element drawn there if that is `el` or inside it. */
  function aim(el) {
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
    const y = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
    const point = { x, y };
    if (el === document.body || el === document.documentElement) return { point, hit: el };
    const hit = document.elementFromPoint(x, y);
    return { point, hit: hit && el.contains(hit) ? hit : el };
  }

  const focusTarget = (el) => el.closest(FOCUSABLE) || null;

  function click(el) {
    const { point, hit: first } = aim(el);
    let hit = first;
    movePointer(hit, point);
    const again = () => {
      if (!hit.isConnected) hit = document.elementFromPoint(point.x, point.y) || el;
      return hit;
    };
    const down = pointerEvent(hit, "pointerdown", point, 0, 1);
    const mouseDown = mouseEvent(hit, "mousedown", point, 0, 1, 1);
    if (!down.defaultPrevented && !mouseDown.defaultPrevented) {
      const focus = focusTarget(hit);
      if (focus && !focus.disabled) focus.focus({ preventScroll: true });
      else if (document.activeElement && (isTextControl(document.activeElement) || isEditable(document.activeElement))) document.activeElement.blur();
      // Anything else keeps focus: a script's blur() makes the next script focus() draw a focus ring, which a click never does.
    }
    hit = again();
    pointerEvent(hit, "pointerup", point, 0, 0);
    mouseEvent(hit, "mouseup", point, 0, 0, 1);
    hit = again();
    mouseEvent(hit, "click", point, 0, 0, 1);
  }

  function hover(el) {
    const { point, hit } = aim(el);
    movePointer(hit, point);
  }

  // ---------------------------------------------------------------- values

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
  }

  const TEXT_INPUT_TYPES = ["", "text", "search", "tel", "url", "email", "password", "number"];
  const isTextControl = (el) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.includes((el.type || "").toLowerCase()));
  const isEditable = (el) => el.isContentEditable && !isTextControl(el);

  function inputEvent(el, type, data, inputType) {
    return fire(el, InputEvent, type, { data, inputType, cancelable: type === "beforeinput" });
  }

  function fill(el, text) {
    if (!(isTextControl(el) || isEditable(el))) {
      const inner = el.querySelector && el.querySelector("input,textarea,[contenteditable]");
      if (inner) return fill(inner, text);
      throw new Error("not a text field");
    }
    el.focus({ preventScroll: true });
    if (isTextControl(el)) {
      if (el.select) el.select();
      inputEvent(el, "beforeinput", text, "insertReplacementText");
      setNativeValue(el, text);
      try { el.setSelectionRange(text.length, text.length); } catch { /* number inputs have no selection */ }
      inputEvent(el, "input", text, "insertReplacementText");
      fire(el, Event, "change", { cancelable: false });
    } else {
      inputEvent(el, "beforeinput", text, "insertReplacementText");
      el.textContent = text;
      inputEvent(el, "input", text, "insertReplacementText");
    }
  }

  const checkedState = (el) => {
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) return el.checked;
    return el.getAttribute("aria-checked") === "true";
  };

  function setChecked(el, wanted) {
    if (checkedState(el) === wanted) return;
    if (el instanceof HTMLInputElement && el.type === "radio" && !wanted) throw new Error("a radio button cannot be unchecked");
    click(el);
    if (checkedState(el) !== wanted) throw new Error("clicking it did not change its state");
  }

  // ---------------------------------------------------------------- keys

  const KEY_ALIASES = { ControlOrMeta: "Control", Esc: "Escape", Return: "Enter", Space: " ", Del: "Delete" };
  const KEY_CODES = {
    Enter: 13, Escape: 27, Tab: 9, " ": 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Backspace: 8, Delete: 46,
    PageUp: 33, PageDown: 34, End: 35, Home: 36, Shift: 16, Control: 17, Alt: 18, Meta: 91,
  };

  function keyInfo(key) {
    const code =
      key.length === 1 && /[a-z]/i.test(key) ? "Key" + key.toUpperCase()
        : key.length === 1 && /[0-9]/.test(key) ? "Digit" + key
          : key === " " ? "Space"
            : key === "Control" ? "ControlLeft" : key === "Shift" ? "ShiftLeft" : key === "Alt" ? "AltLeft" : key === "Meta" ? "MetaLeft"
              : key;
    const keyCode = KEY_CODES[key] || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
    return { key, code, keyCode, which: keyCode };
  }

  function deleteText(el, forward) {
    if (!isTextControl(el) || el.type === "number" || el.type === "email") {
      if (isTextControl(el)) {
        const value = el.value;
        if (!value) return;
        setNativeValue(el, forward ? value.slice(1) : value.slice(0, -1));
        inputEvent(el, "input", null, forward ? "deleteContentForward" : "deleteContentBackward");
      }
      return;
    }
    let start = el.selectionStart ?? el.value.length;
    let end = el.selectionEnd ?? start;
    if (start === end) {
      if (forward) end = Math.min(el.value.length, end + 1);
      else start = Math.max(0, start - 1);
    }
    if (start === end) return;
    setNativeValue(el, el.value.slice(0, start) + el.value.slice(end));
    el.setSelectionRange(start, start);
    inputEvent(el, "input", null, forward ? "deleteContentForward" : "deleteContentBackward");
  }

  function insertText(el, text) {
    if (!isTextControl(el)) return;
    let start = el.value.length;
    let end = start;
    try { start = el.selectionStart ?? start; end = el.selectionEnd ?? start; } catch { /* number inputs have no selection */ }
    inputEvent(el, "beforeinput", text, "insertText");
    setNativeValue(el, el.value.slice(0, start) + text + el.value.slice(end));
    try { el.setSelectionRange(start + text.length, start + text.length); } catch { /* as above */ }
    inputEvent(el, "input", text, "insertText");
  }

  function press(el, combo) {
    const parts = combo.split(/\+(?=.)/).map((p) => KEY_ALIASES[p] ?? p);
    const main = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);
    const flags = {
      ctrlKey: modifiers.includes("Control"), shiftKey: modifiers.includes("Shift"),
      altKey: modifiers.includes("Alt"), metaKey: modifiers.includes("Meta"),
    };
    if (el !== document.activeElement && isFocusable(el)) el.focus({ preventScroll: true });
    const active = document.activeElement && document.activeElement !== document.body ? document.activeElement : el;
    for (const m of modifiers) fire(active, KeyboardEvent, "keydown", { ...keyInfo(m), ...flags });
    const info = keyInfo(main);
    const down = fire(active, KeyboardEvent, "keydown", { ...info, ...flags });
    const printable = main.length === 1 && !flags.ctrlKey && !flags.metaKey;
    if (!down.defaultPrevented) {
      if (main === "Enter" || printable) {
        const pressed = fire(active, KeyboardEvent, "keypress", { ...info, ...flags, charCode: main === "Enter" ? 13 : main.charCodeAt(0) });
        if (!pressed.defaultPrevented) {
          if (printable) insertText(active, main);
          else if (main === "Enter") enter(active);
        }
      } else if (main === "Backspace") deleteText(active, false);
      else if (main === "Delete") deleteText(active, true);
      else if (flags.ctrlKey && main.toLowerCase() === "a" && isTextControl(active) && active.select) active.select();
    }
    const up = fire(active, KeyboardEvent, "keyup", { ...info, ...flags });
    if (!down.defaultPrevented && !up.defaultPrevented && main === " " && !flags.ctrlKey) spaceUp(active);
    for (const m of modifiers.slice().reverse()) fire(active, KeyboardEvent, "keyup", { ...keyInfo(m), ...flags });
  }

  /** The default action of Enter: activate a button or link, submit the form of a text field. */
  function enter(el) {
    if (el instanceof HTMLTextAreaElement || isEditable(el)) {
      if (el instanceof HTMLTextAreaElement) insertText(el, "\n");
      return;
    }
    if (el instanceof HTMLInputElement && ["checkbox", "radio"].includes(el.type)) return;
    if (el.matches("button,a[href],summary,input[type=button],input[type=submit],input[type=reset],input[type=image]")) {
      mouseEvent(el, "click", aim(el).point, 0, 0, 1);
      return;
    }
    if (el instanceof HTMLInputElement && el.form) {
      const form = el.form;
      const submit = form.querySelector("button:not([type]),button[type=submit],input[type=submit],input[type=image]");
      const fields = [...form.elements].filter((f) => f instanceof HTMLInputElement && isTextControl(f));
      if (submit || fields.length <= 1) form.requestSubmit(submit && !submit.disabled ? submit : undefined);
    }
  }

  function spaceUp(el) {
    if (el.matches("button,summary,input[type=button],input[type=submit],input[type=reset],input[type=checkbox],input[type=radio]")) {
      mouseEvent(el, "click", aim(el).point, 0, 0, 1);
    }
  }

  // ---------------------------------------------------------------- perform

  const nextFrame = () => new Promise((done) => {
    const timer = setTimeout(done, 100);
    requestAnimationFrame(() => { clearTimeout(timer); done(); });
  });
  /** Let React and the browser take in what a gesture did. */
  async function settle() {
    await nextFrame();
    await nextFrame();
    await new Promise((done) => setTimeout(done, 0));
  }

  const TIMEOUT = 4000;

  async function find(target, what, loose) {
    // performance.now, not Date.now: a test may have fixed the clock.
    const deadline = performance.now() + TIMEOUT;
    for (;;) {
      const all = resolveAll(target, loose);
      if (all.length > 0) {
        if (all.length > 1) api.warnings.push(`${what}: ${describe(target)} matches ${all.length} elements; the first is used`);
        return all[0];
      }
      if (performance.now() > deadline) throw new Error(`astryx-drive: ${what}: nothing visible matches ${describe(target)}`);
      await new Promise((done) => setTimeout(done, 50));
    }
  }

  /** @param {{ target: LocatorOp[], gesture: Gesture }[]} gestures @returns {Promise<void>} */
  async function perform(gestures) {
    for (let i = 0; i < gestures.length; i++) {
      const { target, gesture } = gestures[i];
      const what = `gesture ${i + 1} (${gesture.kind})`;
      // A key goes to the focused element, drawn or not; every other gesture needs something to see.
      const el = await find(target, what, gesture.kind === "press");
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      pointerMode = !["press", "fill"].includes(gesture.kind);
      try {
        switch (gesture.kind) {
          case "click": click(el); break;
          case "hover": hover(el); break;
          case "fill": fill(el, gesture.text); break;
          case "check": setChecked(el, true); break;
          case "uncheck": setChecked(el, false); break;
          case "press": press(el, gesture.key); break;
          case "select": await select(el, gesture.value); break;
          default: throw new Error("unknown gesture " + JSON.stringify(gesture));
        }
      } catch (error) {
        throw new Error(`astryx-drive: ${what} on ${describe(target)}: ${error && error.message ? error.message : error}`);
      }
      await settle();
    }
  }

  /** A select element takes the value (or the option with that label); anything else is a custom select: open it, click the option. */
  async function select(el, value) {
    if (el instanceof HTMLSelectElement) {
      const option = [...el.options].find((o) => o.value === value) || [...el.options].find((o) => normalize(o.textContent || "") === normalize(value));
      if (!option) throw new Error(`no option ${JSON.stringify(value)}`);
      el.focus({ preventScroll: true });
      setNativeValue(el, option.value);
      fire(el, Event, "input", {});
      fire(el, Event, "change", {});
      return;
    }
    click(el);
    await settle();
    const target = [{ by: "role", role: "option", name: value, exact: true }];
    const option = await find(target, "select");
    click(option);
  }

  const api = { resolve, resolveAll, perform, roleOf, nameOf, describe, warnings: [] };
  window.__astryxDrive = api;
})();
