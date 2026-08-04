import AVFoundation
import Combine

@MainActor
final class AudioPlayer: ObservableObject {
    nonisolated static let recordingResourceName = "c-recto-canonical-roger-0.9"

    @Published private(set) var errorMessage: String?
    private var player: AVAudioPlayer?

    func play(copy: InterfaceCopy) {
        guard let url = Bundle.main.url(
            forResource: Self.recordingResourceName,
            withExtension: "mp3"
        ) else {
            errorMessage = copy.missingAudio
            return
        }

        do {
            player = try AVAudioPlayer(contentsOf: url)
            player?.prepareToPlay()
            player?.play()
            errorMessage = nil
        } catch {
            errorMessage = copy.playbackFailed
        }
    }
}
