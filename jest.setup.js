// Expo 54 usa import.meta internamente. Jest no lo soporta,
// así que inicializamos el registry manualmente antes de cada test.
global.__ExpoImportMetaRegistry = {};
