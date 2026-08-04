import XCTest
@testable import ExamenPracticoSpike

final class CatalogLoaderTests: XCTestCase {
    func testLoadsTheExactProductionCatalogAndCanonicalStraightCommand() throws {
        let commands = try CatalogLoader.load(bundle: .main)
        XCTAssertEqual(commands.count, 36)

        let model = try CommandViewModel(
            commands: commands,
            commandID: "c-recto",
            phrasingID: "c-recto-canonical"
        )

        XCTAssertEqual(model.spanish, "Siga todo recto")
        XCTAssertEqual(model.english, "continue straight ahead")
        XCTAssertEqual(model.acceptedResult, "continue-forward")
    }

    func testUnknownCommandThrowsItsStableIdentifier() throws {
        let commands = try CatalogLoader.load(bundle: .main)

        XCTAssertThrowsError(
            try CommandViewModel(
                commands: commands,
                commandID: "missing-command",
                phrasingID: "c-recto-canonical"
            )
        ) { error in
            XCTAssertEqual(
                error as? CatalogError,
                .commandNotFound("missing-command")
            )
        }
    }

    func testUnknownPhrasingThrowsItsStableIdentifier() throws {
        let commands = try CatalogLoader.load(bundle: .main)

        XCTAssertThrowsError(
            try CommandViewModel(
                commands: commands,
                commandID: "c-recto",
                phrasingID: "missing-phrasing"
            )
        ) { error in
            XCTAssertEqual(
                error as? CatalogError,
                .phrasingNotFound("missing-phrasing")
            )
        }
    }
}
