import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { ReactNode } from "react";

export type AuthLayoutProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthLayout({ title, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {children}
          {footer}
        </CardContent>
      </Card>
    </div>
  );
}
