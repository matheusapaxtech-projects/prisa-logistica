import { registerRootComponent } from 'expo';

// A tarefa de localização em segundo plano precisa existir antes do app (expo-task-manager).
import './src/localizacao';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
