import Foundation
import XCTest
@testable import ExamenPracticoSpike

final class AudioResourceTests: XCTestCase {
    func testUsesTheExactBundledProductionRecording() throws {
        XCTAssertEqual(
            AudioPlayer.recordingResourceName,
            "c-recto-canonical-roger-0.9"
        )

        let url = Bundle.main.url(
            forResource: AudioPlayer.recordingResourceName,
            withExtension: "mp3"
        )

        XCTAssertNotNil(url)
        XCTAssertEqual(try Data(contentsOf: XCTUnwrap(url)).count, 25_539)
    }
}
