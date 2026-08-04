import Foundation

enum CatalogLoader {
    static func load(bundle: Bundle) throws -> [CatalogCommand] {
        guard let url = bundle.url(forResource: "commands", withExtension: "json") else {
            throw CatalogError.missingResource
        }

        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([CatalogCommand].self, from: data)
    }
}
