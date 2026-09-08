import { loginRequestSchema } from "@repo/contracts";
import { translateApiError } from "@repo/i18n";
import { Button, Input, Label } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { isAuthApiError, useLoginMutation } from "../../../hooks/use-auth-mutations.js";

export type SignInFormProps = {
  onSuccess?: () => void;
};

export function SignInForm({ onSuccess }: SignInFormProps) {
  const { t } = useTranslation();
  const loginMutation = useLoginMutation();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const parsed = loginRequestSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      await loginMutation.mutateAsync(parsed.data);
      onSuccess?.();
    },
  });

  const errorMessage =
    loginMutation.error && isAuthApiError(loginMutation.error)
      ? translateApiError(t, loginMutation.error.apiError)
      : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      noValidate
    >
      <form.Field name="email">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>{t("auth.emailLabel")}</Label>
            <Input
              id={field.name}
              name={field.name}
              type="email"
              autoComplete="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>{t("auth.passwordLabel")}</Label>
            <Input
              id={field.name}
              name={field.name}
              type="password"
              autoComplete="current-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={loginMutation.isPending}>
        {t("auth.signInCta")}
      </Button>
    </form>
  );
}
