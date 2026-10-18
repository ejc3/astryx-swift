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

/// A code block: title and language, a Copy control and the code in the theme's syntax colors.
struct TChatCodeBlock: View {
    let title: String
    let language: String
    let code: String
    @Environment(\.ax) private var ax
    @Environment(\.axStatic) private var isStatic

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: ax.space(2)) {
                Text(title)
                    .font(ax.font("font-size-sm", 12, weight: "font-weight-medium", design: .monospaced))
                    .foregroundStyle(ax.text)
                    .lineLimit(1)
                Text(language)
                    .font(ax.fontXSmall)
                    .foregroundStyle(ax.textSecondary)
                Spacer(minLength: ax.space(2))
                Button {
                    tChatCopy(code)
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: ax.fontSize("font-size-sm", 12)))
                        .foregroundStyle(ax.iconSecondary)
                        .padding(ax.space(1))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Copy \(title)")
            }
            .padding(.horizontal, ax.space(3))
            .padding(.vertical, ax.space(2))
            Rectangle().fill(ax.border).frame(height: 1)
            Group {
                if isStatic {
                    codeText.fixedSize(horizontal: false, vertical: true)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) { codeText.fixedSize() }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(ax.space(3))
        }
        .background(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).fill(ax.color("color-syntax-background")))
        .overlay(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous).strokeBorder(ax.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: ax.radiusContainer, style: .continuous))
        .accessibilityElement(children: .contain)
    }

    private var codeText: some View {
        Text(TChatSyntax.highlight(code, ax: ax))
            .font(ax.font("font-size-sm", 12, design: .monospaced))
            .foregroundStyle(ax.text)
            .textSelection(.enabled)
    }
}

/// A light highlighter for the C-family sample code of the model: comments, strings,
/// numbers and keywords, painted with the theme's `color-syntax-*` tokens.
enum TChatSyntax {
    private static let rules: [(pattern: String, token: String)] = [
        ("//[^\\n]*", "color-syntax-comment"),
        ("'(?:\\\\.|[^'\\\\\\n])*'|\"(?:\\\\.|[^\"\\\\\\n])*\"|`(?:\\\\.|[^`\\\\])*`", "color-syntax-string"),
        ("\\b\\d+(?:\\.\\d+)?\\b", "color-syntax-number"),
        ("\\b(?:async|await|try|catch|const|let|var|if|else|return|new|function|instanceof|import|from|export|throw|describe|it|expect)\\b", "color-syntax-keyword"),
    ]

    static func highlight(_ code: String, ax: AXStyle) -> AttributedString {
        var out = AttributedString(code)
        let ns = code as NSString
        var claimed: [NSRange] = []
        for rule in rules {
            guard let regex = try? NSRegularExpression(pattern: rule.pattern) else { continue }
            for match in regex.matches(in: code, range: NSRange(location: 0, length: ns.length)) {
                let range = match.range
                if claimed.contains(where: { NSIntersectionRange($0, range).length > 0 }) { continue }
                claimed.append(range)
                guard let r = Range(range, in: code) else { continue }
                let lower = code.distance(from: code.startIndex, to: r.lowerBound)
                let upper = code.distance(from: code.startIndex, to: r.upperBound)
                let start = out.index(out.startIndex, offsetByCharacters: lower)
                let end = out.index(out.startIndex, offsetByCharacters: upper)
                out[start..<end].foregroundColor = ax.color(rule.token)
            }
        }
        return out
    }
}
