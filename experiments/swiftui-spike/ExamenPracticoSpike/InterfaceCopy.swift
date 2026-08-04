import Foundation

struct InterfaceCopy {
    let title: String
    let meaningLabel: String
    let play: String
    let disclosure: String
    let loadingFailed: String
    let missingAudio: String
    let playbackFailed: String
}

let english = InterfaceCopy(
    title: "Practical Exam",
    meaningLabel: "Meaning",
    play: "Play Spanish",
    disclosure: "This Spanish voice is AI-generated.",
    loadingFailed: "The practice command could not be loaded.",
    missingAudio: "The bundled Spanish recording is unavailable.",
    playbackFailed: "The bundled Spanish recording could not be played."
)

let spanish = InterfaceCopy(
    title: "Examen Práctico",
    meaningLabel: "Significado en inglés",
    play: "Reproducir español",
    disclosure: "Esta voz en español ha sido generada por IA.",
    loadingFailed: "La instrucción de práctica no se pudo cargar.",
    missingAudio: "La grabación en español no está disponible.",
    playbackFailed: "No se pudo reproducir la grabación en español."
)

enum InterfaceLocale {
    case en
    case es

    var copy: InterfaceCopy {
        switch self {
        case .en:
            english
        case .es:
            spanish
        }
    }
}
