import Foundation

/// How this drawing lays the inbox out, from ITS OWN width and pointer only.
///
/// The core is one state drawn at once by several drawings (this one, the web page), each at its
/// own width, so it does not decide layout from any one drawing's measurements. It sends the
/// breakpoints (`mode.rules`) and what was opened or closed (`choice`); this type applies them
/// to this drawing's width. Nothing in it reads a measurement the core holds.
struct InboxLayout: Equatable {
    /// The list and the thread are shown one at a time (the surface is narrower than the rule).
    var isSingleSurface: Bool
    /// The thread this drawing shows: the person's choice, else the top thread when there is room.
    var openId: String?
    /// The primary pointer cannot hover.
    var isTouch: Bool
    /// The list's rows stack (a narrow list).
    var isStacked = false
    /// The list drops its tags column.
    var isTight = false
    /// The bulk band replaces the tab strip.
    var hasSelection = false

    /// The surface-level facts, from the width the whole surface has.
    init(_ model: InboxModel, surfaceWidth: Double, isTouch: Bool) {
        let rules = model.mode.rules
        let single = Int(surfaceWidth.rounded()) < rules.singleSurfaceBelow
        self.isSingleSurface = single
        self.isTouch = isTouch
        // The model's own rule: the person's choice (open or closed) wins; otherwise the top thread, where there is room.
        if model.choice.isClosed {
            openId = nil
        } else {
            openId = model.choice.openIdExplicit ?? (single ? nil : model.choice.firstVisibleId)
        }
        // Until the list's width is known, it has the surface's.
        self = self.listed(model, listWidth: surfaceWidth)
    }

    /// The same layout once the list column's width is known: stacked and tight rows, the bulk band.
    func listed(_ model: InboxModel, listWidth: Double) -> InboxLayout {
        var next = self
        let rules = model.mode.rules
        let list = Int(listWidth.rounded())
        next.isStacked = list < rules.stackRowsBelow
        next.isTight = list < rules.tightenColumnsBelow
        next.hasSelection = model.hasSelectedRows && !next.isStacked
        return next
    }

    /// The thread to draw, among the model's `panes`.
    func pane(in model: InboxModel) -> InboxModel.Pane? {
        guard let openId else { return nil }
        return model.panes.first { $0.id == openId }
    }

    /// A row's actions in this layout.
    func actions(of row: InboxModel.Row) -> [InboxModel.RowAction] {
        isStacked ? row.actionsStacked : row.actionsWide
    }
}
