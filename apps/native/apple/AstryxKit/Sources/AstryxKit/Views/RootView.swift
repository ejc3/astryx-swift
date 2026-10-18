import SwiftUI

/// The whole app: a sidebar of the core's `nav`, the current screen, the toast and the dialog.
/// On a phone the split view collapses to a navigation stack.
///
/// With `web` and `stock` views (owned by the host), the toolbar also offers the core's
/// `surface` choice: the SwiftUI drawing, either web drawing, Astryx as it is today, or
/// several side by side when the window is large enough.
public struct RootView: View {
    @ObservedObject private var model: AppModel
    private let web: AnyView?
    private let webOwn: AnyView?
    private let stock: AnyView?
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.scenePhase) private var scenePhase

    /// The SwiftUI drawing only.
    public init(model: AppModel) {
        self.model = model
        self.web = nil
        self.webOwn = nil
        self.stock = nil
    }

    /// The SwiftUI drawing, with the host's views of the other drawings: the web page on the
    /// shared core, the web page on a core of its own, and Astryx as it is today.
    public init(model: AppModel, web: AnyView, webOwn: AnyView, stock: AnyView) {
        self.model = model
        self.web = web
        self.webOwn = webOwn
        self.stock = stock
    }

    public var body: some View {
        Group {
            if let app = model.app {
                if let web, let webOwn, let stock {
                    GeometryReader { geo in
                        SurfaceRoot(app: app, size: geo.size, web: web, webOwn: webOwn, stock: stock)
                    }
                } else {
                    AppShell(app: app, picker: nil)
                }
            } else {
                ProgressView()
            }
        }
        .axTheme(model.theme, scheme: scheme, typeSize: typeSize)
        .environment(\.axSend, AXSender { [model] action in model.perform(action) })
        .alert(
            model.app?.dialog?.title ?? "",
            isPresented: Binding(get: { model.app?.dialog != nil }, set: { _ in }),
            presenting: model.app?.dialog
        ) { dialog in
            Button(dialog.confirm.label, role: dialog.confirm.variant == .destructive ? .destructive : nil) {
                model.perform(.press(id: dialog.confirm.id))
            }
            Button(dialog.cancel.label, role: .cancel) {
                model.perform(.press(id: dialog.cancel.id))
            }
        } message: { dialog in
            Text(dialog.text)
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            if phase == .active { model.startTicking() } else { model.stopTicking() }
        }
    }
}

// MARK: Surfaces

/// Which drawing, or drawings, of the screens are on display.
enum SurfaceMode: String {
    case native, web, webOwn, stock, compare, all

    /// Windows at least this wide (points) can show native and web side by side.
    static let compareFrom: CGFloat = 1100
    /// Windows at least this big can show all four drawings as a grid.
    static let allFrom = CGSize(width: 1400, height: 800)

    init(_ value: String?) { self = SurfaceMode(rawValue: value ?? "") ?? .native }

    func fits(_ size: CGSize) -> Bool {
        switch self {
        case .compare: size.width >= SurfaceMode.compareFrom
        case .all: size.width >= SurfaceMode.allFrom.width && size.height >= SurfaceMode.allFrom.height
        default: true
        }
    }

    /// A side-by-side choice in a window too small for it draws as the SwiftUI drawing.
    func effective(_ size: CGSize) -> SurfaceMode { fits(size) ? self : .native }
}

/// The surface choice as a segmented control in the toolbar. Choosing sends `set` with the
/// snapshot's `surface.id`; options that do not fit the window are left out.
struct SurfacePicker: View {
    let surface: AppSnapshot.SurfaceChoice
    let size: CGSize
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    private var visible: [Option] {
        surface.options.filter { SurfaceMode($0.value).fits(size) }
    }
    private var selection: String {
        SurfaceMode(surface.value).effective(size).rawValue
    }

    var body: some View {
        if isStatic {
            StaticSegmented(options: visible, value: selection)
        } else {
            Picker(surface.label, selection: Binding(
                get: { selection },
                set: { send(.set(id: surface.id, value: .string($0))) }
            )) {
                ForEach(visible, id: \.value) { Text($0.label).tag($0.value) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .accessibilityLabel(surface.label)
            .fixedSize()
        }
    }
}

/// Chooses the layout for the surface, native included, and puts the picker in its toolbar.
private struct SurfaceRoot: View {
    let app: AppSnapshot
    let size: CGSize
    let web: AnyView
    let webOwn: AnyView
    let stock: AnyView

    var body: some View {
        if let surface = app.surface {
            let mode = SurfaceMode(surface.value).effective(size)
            let picker = SurfacePicker(surface: surface, size: size)
            if mode == .native {
                AppShell(app: app, picker: AnyView(picker))
            } else {
                NavigationStack {
                    SurfaceLayout(app: app, mode: mode, web: web, webOwn: webOwn, stock: stock)
                        .toolbar {
                            ToolbarItem(placement: .primaryAction) { picker }
                        }
                        #if os(iOS)
                        .navigationBarTitleDisplayMode(.inline)
                        #endif
                }
            }
        } else {
            AppShell(app: app, picker: nil)
        }
    }
}

/// The non-native layouts: one drawing filling the window, or several side by side (two
/// columns, or a 2 by 2 grid), each under a caption of its option's label and description.
struct SurfaceLayout: View {
    let app: AppSnapshot
    let mode: SurfaceMode
    let web: AnyView
    let webOwn: AnyView
    let stock: AnyView
    @Environment(\.ax) private var ax

    var body: some View {
        switch mode {
        case .native: cell(.native)
        case .web, .webOwn, .stock: cell(mode)
        case .compare:
            HStack(spacing: 0) {
                cell(.native)
                divider(vertical: true)
                cell(.web)
            }
        case .all:
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    cell(.native)
                    divider(vertical: true)
                    cell(.web)
                }
                divider(vertical: false)
                HStack(spacing: 0) {
                    cell(.webOwn)
                    divider(vertical: true)
                    cell(.stock)
                }
            }
        }
    }

    private func divider(vertical: Bool) -> some View {
        Rectangle().fill(ax.borderStrong)
            .frame(width: vertical ? 1 : nil, height: vertical ? nil : 1)
    }

    /// One drawing under its caption.
    private func cell(_ drawing: SurfaceMode) -> some View {
        VStack(spacing: 0) {
            caption(drawing)
            // The drawing is an overlay of an empty box, so its own ideal size cannot stretch
            // the cell; the cell is what the layout gives it.
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .overlay(alignment: .topLeading) {
                    switch drawing {
                    case .web: web
                    case .webOwn: webOwn
                    case .stock: stock
                    default: NativeColumn(app: app)
                    }
                }
                .clipped()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func caption(_ drawing: SurfaceMode) -> some View {
        let option = app.surface?.options.first { $0.value == drawing.rawValue }
        return HStack(spacing: ax.space(2)) {
            Text(option?.label ?? "")
                .font(ax.font("font-size-sm", 12, weight: "font-weight-semibold"))
                .foregroundStyle(ax.text)
            if let description = drawing == .stock ? (app.surface?.stockLabel ?? option?.description) : option?.description {
                Text(description)
                    .font(ax.fontSmall)
                    .foregroundStyle(ax.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, ax.space(3))
        .padding(.vertical, ax.space(1))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ax.surface)
        .overlay(alignment: .bottom) { Rectangle().fill(ax.border).frame(height: 1) }
        .accessibilityElement(children: .combine)
    }
}

/// The SwiftUI drawing as one column of a side-by-side layout: a narrow sidebar and the
/// screen, without a navigation container of their own.
struct NativeColumn: View {
    let app: AppSnapshot
    @Environment(\.axSend) private var send
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        HStack(spacing: 0) {
            Group {
                if isStatic {
                    StaticSidebar(app: app)
                } else {
                    SidebarView(app: app, selection: Binding(
                        get: { app.current },
                        set: { if $0 != app.current { send(.navigate(screen: $0)) } }
                    ))
                }
            }
            .frame(width: 190)
            ScreenView(app: app, inlineToolbar: true, scrolls: !isStatic)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// The split view proper, below the theme and the sender.
private struct AppShell: View {
    let app: AppSnapshot
    /// The surface picker, when the host gave web views.
    let picker: AnyView?
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        NavigationSplitView {
            SidebarView(app: app, selection: Binding(
                get: { app.current },
                set: { if $0 != app.current { send(.navigate(screen: $0)) } }
            ))
            #if os(macOS)
            .navigationSplitViewColumnWidth(min: 200, ideal: 240, max: 320)
            #endif
        } detail: {
            ScreenView(app: app, inlineToolbar: false)
                .toolbar {
                    if let picker {
                        ToolbarItem(placement: .primaryAction) { picker }
                    }
                }
        }
        .tint(ax.accent)
    }
}

/// One nav entry: icon, label and the core's badge.
private struct SidebarRow: View {
    let item: NavItem
    let selected: Bool
    @Environment(\.ax) private var ax

    var body: some View {
        HStack(spacing: ax.space(3)) {
            Image(systemName: item.icon.symbol)
                .frame(width: ax.fontSize("font-size-lg", 17) * 1.3)
                .foregroundStyle(selected ? ax.accent : ax.iconSecondary)
            Text(item.label)
                .font(ax.fontLabel)
                .foregroundStyle(ax.text)
            Spacer(minLength: ax.space(2))
            if let badge = item.badge {
                Text(badge)
                    .font(ax.font("font-size-xs", 10, weight: "font-weight-semibold"))
                    .foregroundStyle(ax.tone(.accent).text)
                    .padding(.horizontal, ax.space(2))
                    .padding(.vertical, ax.hair)
                    .background(Capsule().fill(ax.accentMuted))
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The nav list: icon, label and the core's badge for each screen.
struct SidebarView: View {
    let app: AppSnapshot
    @Binding var selection: String
    @Environment(\.ax) private var ax

    var body: some View {
        List(selection: Binding<String?>(get: { selection }, set: { if let v = $0 { selection = v } })) {
            ForEach(app.nav) { item in
                SidebarRow(item: item, selected: item.id == selection).tag(item.id)
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(ax.surface)
        .navigationTitle(app.appName)
    }
}

/// The same rows without a List, for rendering a window to an image (a List draws nothing
/// without a window).
struct StaticSidebar: View {
    let app: AppSnapshot
    @Environment(\.ax) private var ax

    var body: some View {
        VStack(alignment: .leading, spacing: ax.space(1)) {
            Text(app.appName)
                .font(ax.fontStrong)
                .foregroundStyle(ax.text)
                .padding(.horizontal, ax.space(3))
                .padding(.bottom, ax.space(3))
            ForEach(app.nav) { item in
                SidebarRow(item: item, selected: item.id == app.current)
                    .padding(.horizontal, ax.space(3))
                    .padding(.vertical, ax.space(2))
                    .background(RoundedRectangle(cornerRadius: ax.radiusElement, style: .continuous).fill(item.id == app.current ? ax.accentMuted : .clear))
            }
            Spacer(minLength: 0)
        }
        .padding(ax.space(3))
        .frame(maxHeight: .infinity, alignment: .top)
        .background(ax.surface)
    }
}

/// The current screen: its title and subtitle, toolbar and body, with the toast over it.
/// `inlineToolbar` draws the toolbar buttons in the header instead of the window toolbar,
/// for rendering without a window.
struct ScreenView: View {
    let app: AppSnapshot
    var inlineToolbar: Bool
    var scrolls: Bool = true
    /// The width to lay out in, when known (rendering without a window); else it is measured.
    var fixedWidth: CGFloat? = nil
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        Group {
            if let fixedWidth {
                page(width: fixedWidth)
            } else {
                GeometryReader { geo in page(width: geo.size.width) }
            }
        }
        .background(ax.page)
        .overlay(alignment: .bottom) {
            if let toast = app.toast {
                ToastView(toast: toast)
                    .id(toast.id)
                    .padding(ax.space(4))
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: app.toast?.id)
        .navigationTitle(app.screen.title)
        #if os(macOS)
        .navigationSubtitle(app.screen.subtitle)
        #else
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            if !inlineToolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    ForEach(app.screen.toolbar, id: \.id) { button in
                        ToolbarButton(node: button)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func page(width: CGFloat) -> some View {
        let pad = width < 600 ? ax.space(4) : ax.space(6)
        let content = VStack(alignment: .leading, spacing: ax.space(6)) {
            header
            NodeView(node: app.screen.body)
        }
        .padding(pad)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .environment(\.axWidth, width - 2 * pad)

        if scrolls {
            ScrollView { content }
        } else {
            content.frame(maxHeight: .infinity, alignment: .top)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: ax.space(4)) {
            VStack(alignment: .leading, spacing: ax.space(1)) {
                Text(app.screen.title)
                    .font(ax.heading(1))
                    .foregroundStyle(ax.text)
                    .accessibilityAddTraits(.isHeader)
                Text(app.screen.subtitle)
                    .font(ax.fontBase)
                    .foregroundStyle(ax.textSecondary)
            }
            Spacer(minLength: 0)
            if inlineToolbar {
                HStack(spacing: ax.space(2)) {
                    ForEach(app.screen.toolbar, id: \.id) { AXButton(node: $0) }
                }
            }
        }
    }
}

/// A toolbar button of the screen, as the platform's own prominent or bordered button.
private struct ToolbarButton: View {
    let node: ButtonNode
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        Button {
            send(.press(id: node.id))
        } label: {
            if let icon = node.icon {
                Label(node.label, systemImage: icon.symbol)
            } else {
                Text(node.label)
            }
        }
        .disabled(node.disabled ?? false)
        .tint(node.variant == .destructive ? ax.danger : ax.accent)
    }
}

/// The toast: a dark pill with the core's words and its action. It dismisses itself after
/// about four seconds by sending `dismissToast`.
struct ToastView: View {
    let toast: ToastInfo
    @Environment(\.ax) private var ax
    @Environment(\.axSend) private var send

    var body: some View {
        HStack(spacing: ax.space(3)) {
            Circle()
                .fill(ax.tone(toast.tone == .neutral ? .accent : toast.tone).solid)
                .frame(width: 8, height: 8)
            Text(toast.text)
                .font(ax.fontBase)
                .foregroundStyle(ax.page)
            if let action = toast.action {
                Button {
                    send(.press(id: action.id))
                } label: {
                    Text(action.label)
                        .font(ax.fontStrong)
                        .foregroundStyle(ax.page)
                        .underline()
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, ax.space(4))
        .padding(.vertical, ax.space(3))
        .background(
            RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous)
                .fill(ax.color("color-background-inverted"))
                .shadow(color: ax.shadow, radius: 12, y: 4)
        )
        .accessibilityElement(children: .combine)
        .task(id: toast.id) {
            try? await Task.sleep(for: .seconds(4))
            if !Task.isCancelled { await MainActor.run { send(.dismissToast) } }
        }
    }
}
