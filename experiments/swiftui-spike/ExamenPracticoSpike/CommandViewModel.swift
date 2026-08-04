import Foundation

struct CommandViewModel: Equatable {
    let spanish: String
    let english: String
    let acceptedResult: String

    init(
        commands: [CatalogCommand],
        commandID: String,
        phrasingID: String
    ) throws {
        guard let command = commands.first(where: { $0.id == commandID }) else {
            throw CatalogError.commandNotFound(commandID)
        }

        guard let phrasing = command.phrasings.first(where: { $0.id == phrasingID }) else {
            throw CatalogError.phrasingNotFound(phrasingID)
        }

        spanish = phrasing.es
        english = phrasing.en
        acceptedResult = command.acceptedResult
    }
}
