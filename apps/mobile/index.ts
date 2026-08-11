import { registerRootComponent } from 'expo';

import App from './App';

/**
 * Point d'entree Expo. `registerRootComponent` appelle `AppRegistry.registerComponent`
 * et configure l'environnement (Expo Go et build natif) en un seul geste.
 */
registerRootComponent(App);
