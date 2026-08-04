import Foundation

struct CatalogPhrasing: Decodable, Equatable {
    let id: String
    let es: String
    let en: String
}

struct CatalogCommand: Decodable, Equatable, Identifiable {
    let id: String
    let acceptedResult: String
    let phrasings: [CatalogPhrasing]
}

enum CatalogError: Error, Equatable {
    case missingResource
    case commandNotFound(String)
    case phrasingNotFound(String)
}
