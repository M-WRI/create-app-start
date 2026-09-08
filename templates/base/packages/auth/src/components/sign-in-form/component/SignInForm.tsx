import { loginRequestSchema } from "@repo/contracts";
import { Button, Input, Label } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLoginMutation } from "../../../hooks/use-auth-mutations.js";
import {
  type AuthFieldErrors,
  fieldErrorsFromZodIssues,
  resolveAuthSubmitError,
} from "../../../utils/auth-form-errors.js";

export type SignInFormProps = {
  onSuccess?: () => void;
};

export function SignInForm({ onSuccess }: SignInFormProps) {
  const { t } = useTranslation();
  const loginMutation = useLoginMutation();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const parsed = loginRequestSchema.safeParse(value);
      if (!parsed.success) {
        setFieldErrors(fieldErrorsFromZodIssues(parsed.error.issues, "errors.validation.failed"));
        setSubmitError(null);
        return;
      }
      setFieldErrors({});
      setSubmitError(null);
      try {
        await loginMutation.mutateAsync(parsed.data);
        onSuccess?.();
      } catch (error) {
        setSubmitError(error);
      }
    },
  });

  const submitErrorMessage = submitError ? resolveAuthSubmitError(submitError, t) : null;

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
        {(field) => {
          const emailErrorKey = fieldErrors.email;
          const emailErrorId = `${field.name}-error`;
          return (
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
                aria-invalid={Boolean(emailErrorKey)}
                aria-describedby={emailErrorKey ? emailErrorId : undefined}
              />
              {emailErrorKey ? (
                <p id={emailErrorId} role="alert" className="text-sm text-destructive">
                  {t(emailErrorKey)}
                </p>
              ) : null}
            </div>
          );
        }}
      </form.Field>

      <form.Field name="password">
        {(field) => {
          const passwordErrorKey = fieldErrors.password;
          const passwordErrorId = `${field.name}-error`;
          return (
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
                aria-invalid={Boolean(passwordErrorKey)}
                aria-describedby={passwordErrorKey ? passwordErrorId : undefined}
              />
              {passwordErrorKey ? (
                <p id={passwordErrorId} role="alert" className="text-sm text-destructive">
                  {t(passwordErrorKey)}
                </p>
              ) : null}
            </div>
          );
        }}
      </form.Field>

      {submitErrorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {submitErrorMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={loginMutation.isPending}>
        {t("auth.signInCta")}
      </Button>
    </form>
  );
}
