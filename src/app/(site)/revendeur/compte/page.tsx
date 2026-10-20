import { PasswordForm } from "./PasswordForm";

export default function AccountPage() {
  return (
    <div className="max-w-md">
      <h1 className="text-3xl">Mon compte</h1>
      <p className="mt-2 text-sm text-encre/70">Votre pays de résidence et votre profil tarifaire sont gérés par Naaqati. Contactez-nous pour toute modification.</p>
      <PasswordForm />
    </div>
  );
}
