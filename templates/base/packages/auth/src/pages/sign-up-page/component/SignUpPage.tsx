import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthLayout } from "../../../components/auth-layout/index.js";
import { SignUpForm } from "../../../components/sign-up-form/index.js";

export type SignUpPageProps = {
  onSuccess?: () => void;
  signInTo?: string;
};

export function SignUpPage({ onSuccess, signInTo = "/sign-in" }: SignUpPageProps) {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t("auth.signUpTitle")}
      footer={
        <p className="text-sm text-muted-foreground">
          {t("auth.hasAccount")}{" "}
          <Link className="underline" to={signInTo}>
            {t("auth.goToSignIn")}
          </Link>
        </p>
      }
    >
      <SignUpForm onSuccess={onSuccess} />
    </AuthLayout>
  );
}
