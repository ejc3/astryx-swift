import SwiftUI
#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// Copies text to the system pasteboard.
func tChatCopy(_ text: String) {
    #if os(macOS)
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(text, forType: .string)
    #else
    UIPasteboard.general.string = text
    #endif
}

/// A code block as the stock page's CodeBlock draws it: a band with the file name and language (one
/// line, from the core) and a Copy control, then the code in the theme's syntax colors, on the
/// muted ground with a hairline border.
struct TChatCodeBlock: View {
    let title: String
    let header: String
    let code: String
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic
    @Environment(\.tChatWords) private var words
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: ax.space(2)) {
                Text(header)
                    .font(ax.font("font-size-sm", 12, weight: "font-weight-medium", design: .monospaced))
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                    .truncationMode(.middle)
                Spacer(minLength: ax.space(2))
                Button {
                    tChatCopy(code)
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: ax.fontSize("font-size-base", 14)))
                        .foregroundStyle(ax.textSecondary)
                        .frame(width: axMinTarget, height: axMinTarget)
                        .contentShape(Rectangle())
                        // A 28 pt control in a header band (44 x 44 pt to tap on a touch screen).
                        .axTapTarget(keepLayout: true)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(words.copy) \(title)")
            }
            .padding(.horizontal, ax.space(4))
            .padding(.vertical, ax.space(2))
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ax.color("color-syntax-background"))
            Group {
                if isStatic {
                    codeText.fixedSize(horizontal: false, vertical: true)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) { codeText.fixedSize() }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, ax.space(4))
            .padding(.vertical, ax.space(3))
        }
        .background(ax.color("color-syntax-background"))
        .clipShape(shape)
        .overlay(shape.strokeBorder(ax.border, lineWidth: 1))
        .accessibilityElement(children: .contain)
    }

    private var codeText: some View {
        let size = ax.fontSize("font-size-base", 14)
        return Text(TChatSyntax.highlight(code, ax: ax))
            .font(.system(size: size, design: .monospaced))
            .lineSpacing(ax.lineSpacing(size: size, ratio: ax.bodyLeading))
            .foregroundStyle(ax.text)
            .textSelection(.enabled)
    }
}

/// The highlighter of Astryx's CodeBlock for JavaScript and TypeScript (its tokenizer.ts), ported:
/// at each position the first rule that matches there wins, and the text is painted with the
/// theme's `color-syntax-*` tokens (identifiers before a parenthesis are functions, capitalized
/// ones types, symbols operators and punctuation).
enum TChatSyntax {
    private static let keywords = "const|let|var|function|class|if|else|for|while|return|import|export|from|default|async|await|try|catch|throw|new|typeof|instanceof|interface|type|enum|extends|implements|switch|case|break|continue|do|in|of|void|null|undefined|true|false|this|super|yield|delete|static|public|private|protected|readonly|abstract|as|is|keyof|declare|module|namespace|require"

    private static let rules: [(token: String, regex: NSRegularExpression)] = [
        ("color-syntax-comment", "/\\*[\\s\\S]*?\\*/"),
        ("color-syntax-comment", "//[^\\n]*"),
        ("color-syntax-string", "`(?:[^`\\\\]|\\\\.)*`"),
        ("color-syntax-string", "\"(?:[^\"\\\\]|\\\\.)*\""),
        ("color-syntax-string", "'(?:[^'\\\\]|\\\\.)*'"),
        ("color-syntax-constant", "@[\\w]+"),
        ("color-syntax-number", "\\b0[xX][0-9a-fA-F_]+\\b"),
        ("color-syntax-number", "\\b\\d[\\d_]*\\.?[\\d_]*(?:[eE][+-]?\\d+)?\\b"),
        ("color-syntax-keyword", "\\b(?:\(keywords))\\b"),
        ("color-syntax-function", "\\b[a-zA-Z_$][\\w$]*(?=\\s*\\()"),
        ("color-syntax-type", "\\b[A-Z][a-zA-Z0-9_]*\\b"),
        ("color-syntax-operator", "[+\\-*/%=!<>&|^~?:]+"),
        ("color-syntax-punctuation", "[{}()\\[\\];,.]"),
        ("color-syntax-variable", "\\b[a-zA-Z_$][\\w$]*\\b"),
    ].compactMap { token, pattern in
        (try? NSRegularExpression(pattern: pattern)).map { (token, $0) }
    }

    static func highlight(_ code: String, ax: AXStyle) -> AttributedString {
        let ns = code as NSString
        var out = AttributedString()
        var plainStart = 0
        var index = 0
        func flushPlain(to end: Int) {
            guard end > plainStart else { return }
            out += AttributedString(ns.substring(with: NSRange(location: plainStart, length: end - plainStart)))
        }
        let options: NSRegularExpression.MatchingOptions = [.anchored, .withTransparentBounds, .withoutAnchoringBounds]
        while index < ns.length {
            var matched: (token: String, length: Int)?
            for rule in rules {
                let range = NSRange(location: index, length: ns.length - index)
                if let match = rule.regex.firstMatch(in: code, options: options, range: range), match.range.length > 0 {
                    matched = (rule.token, match.range.length)
                    break
                }
            }
            if let matched {
                flushPlain(to: index)
                var piece = AttributedString(ns.substring(with: NSRange(location: index, length: matched.length)))
                piece.foregroundColor = ax.color(matched.token)
                out += piece
                index += matched.length
                plainStart = index
            } else {
                index += 1
            }
        }
        flushPlain(to: ns.length)
        return out
    }
}
