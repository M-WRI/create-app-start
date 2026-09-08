import { registerRequestSchema } from "@repo/contracts";
import { translateApiError } from "@repo/i18n";
import { Button, Input, Label } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { isAuthApiError, useRegisterMutation } from "../../../hooks/use-auth-mutations.js";

export type SignUpFormProps = {
  onSuccess?: () => void;
};

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const { t } = useTranslation();
  const registerMutation = useRegisterMutation();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const parsed = registerRequestSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      await registerMutation.mutateAsync(parsed.data);
      onSuccess?.();
    },
  });

  const errorMessage =
    registerMutation.error && isAuthApiError(registerMutation.error)
      ? translateApiError(t, registerMutation.error.apiError)
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
              autoComplete="new-password"
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

      <Button type="submit" disabled={registerMutation.isPending}>
        {t("auth.signUpCta")}
      </Button>
    </form>
  );
}
