import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Stockage securise de la session Supabase sur mobile.
 *
 * Contrainte reelle, pas facultative : la session (jeton d'acces, jeton de
 * rafraichissement) ne doit jamais atterrir en clair sur le disque. Deux
 * options existantes ne suffisent pas seules :
 *  - `expo-secure-store` chiffre bien via le Keychain (iOS) / Keystore
 *    (Android), mais limite chaque entree a ~2048 octets sur Android : une
 *    session Supabase complete (jetons + metadonnees utilisateur) le
 *    depasse regulierement ;
 *  - `AsyncStorage` seul n'est pas chiffre.
 *
 * Le patron retenu ici (documente par Supabase pour Expo/React Native) resout
 * les deux : une cle AES aleatoire de 256 bits est generee par entree et
 * stockee dans `expo-secure-store` (petite, donc sous la limite) ; la valeur
 * elle-meme est chiffree avec cette cle puis stockee dans `AsyncStorage` (pas
 * de limite de taille pratique). Sans la cle du Keychain/Keystore, le contenu
 * d'`AsyncStorage` est inutilisable.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = Crypto.getRandomBytes(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(this.secureKeyName(key), aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(this.secureKeyName(key));
    if (!encryptionKeyHex) return null;

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  /**
   * `expo-secure-store` restreint les noms de cle a `[A-Za-z0-9._-]+`. Les
   * cles emises par `@supabase/supabase-js` (ex. `sb-<ref>-auth-token`) sont
   * deja conformes, mais on normalise quand meme : une future cle non
   * conforme ne doit jamais faire echouer silencieusement le stockage.
   */
  private secureKeyName(key: string): string {
    return key.replace(/[^A-Za-z0-9._-]/g, '_');
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(this.secureKeyName(key));
  }
}

export const secureSessionStorage = new LargeSecureStore();
