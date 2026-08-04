import SwiftUI

@MainActor
struct ContentView: View {
    @State private var locale: InterfaceLocale = .en
    @StateObject private var audioPlayer = AudioPlayer()

    private let command: CommandViewModel?

    init(bundle: Bundle = .main) {
        command = try? CommandViewModel(
            commands: CatalogLoader.load(bundle: bundle),
            commandID: "c-recto",
            phrasingID: "c-recto-canonical"
        )
    }

    private var copy: InterfaceCopy {
        locale.copy
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Spacer()
                    localeButton("EN", locale: .en)
                    localeButton("ES", locale: .es)
                }

                Text(copy.title)
                    .font(.largeTitle.bold())
                    .foregroundStyle(Color(red: 0.08, green: 0.16, blue: 0.12))

                if let command {
                    VStack(alignment: .leading, spacing: 20) {
                        Text(command.spanish)
                            .font(.system(size: 40, weight: .bold))
                            .foregroundStyle(Color(red: 0.07, green: 0.36, blue: 0.23))
                            .accessibilityLabel(command.spanish)

                        VStack(alignment: .leading, spacing: 8) {
                            Text(copy.meaningLabel.uppercased())
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            Text(command.english)
                                .font(.title2.weight(.semibold))
                        }

                        Button {
                            audioPlayer.play(copy: copy)
                        } label: {
                            Label(copy.play, systemImage: "speaker.wave.2.fill")
                                .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red: 0.07, green: 0.42, blue: 0.28))
                    }
                    .padding(28)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    .shadow(color: .black.opacity(0.08), radius: 16, y: 6)
                } else {
                    errorBanner(copy.loadingFailed)
                }

                if let errorMessage = audioPlayer.errorMessage {
                    errorBanner(errorMessage)
                }

                Text(copy.disclosure)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: 760)
            .padding(32)
            .frame(maxWidth: .infinity)
        }
        .background(Color(red: 0.94, green: 0.96, blue: 0.94))
    }

    private func localeButton(
        _ label: String,
        locale targetLocale: InterfaceLocale
    ) -> some View {
        Button(label) {
            locale = targetLocale
        }
        .frame(minWidth: 52, minHeight: 44)
        .buttonStyle(.bordered)
        .tint(Color(red: 0.07, green: 0.42, blue: 0.28))
        .accessibilityAddTraits(locale == targetLocale ? .isSelected : [])
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(.body.weight(.semibold))
            .foregroundStyle(Color(red: 0.55, green: 0.12, blue: 0.12))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Color(red: 1, green: 0.93, blue: 0.93))
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
