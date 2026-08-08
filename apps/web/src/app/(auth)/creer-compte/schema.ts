import { z } from 'zod';
import { signUpSchema } from '@ise/validation';
import { fr } from '@/i18n/fr';

/**
 * ISE-002 demande le prenom et le nom, que le schema partage ne couvre pas :
 * ils n'appartiennent pas au compte d'authentification mais au futur profil
 * ISE (MASTER PROMPT §6). Ils sont donc ajoutes ici, en intersection avec
 * `signUpSchema`, et conserves dans les metadonnees du compte en attendant
 * la reclamation de profil (ISE-005 / ISE-006).
 */
export const signUpFormSchema = z
  .object({
    firstName: z.string().trim().min(1, fr.auth.signUp.firstNameRequired),
    lastName: z.string().trim().min(1, fr.auth.signUp.lastNameRequired),
  })
  .and(signUpSchema);

export type SignUpFormInput = z.infer<typeof signUpFormSchema>;

export function signUpInputFrom(formData: FormData) {
  return {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
    acceptsTerms: formData.get('acceptsTerms') === 'on',
  };
}
