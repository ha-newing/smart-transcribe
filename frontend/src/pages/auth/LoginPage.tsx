import { useState, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../../convex/_generated/api";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const currentUser = useQuery(api.users.current);
  const updateUserAfterAuth = useMutation(api.users.updateUserAfterAuth);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupPending, setSetupPending] = useState(false);

  // After sign-in, set up user with company and role
  useEffect(() => {
    if (currentUser && !setupPending && (!currentUser.role || !currentUser.companyId)) {
      setSetupPending(true);
      updateUserAfterAuth({
        userId: currentUser._id,
        email: currentUser.email || email
      }).then(() => {
        setSetupPending(false);
        navigate("/");
      }).catch((error) => {
        console.error("Error setting up user:", error);
        setSetupPending(false);
      });
    } else if (currentUser && currentUser.role && currentUser.companyId) {
      navigate("/");
    }
  }, [currentUser, setupPending, updateUserAfterAuth, navigate, email]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Request verification code
      await signIn("sendgrid-otp", { email });
      setStep("code");
    } catch (error) {
      console.error("Error sending code:", error);
      alert("Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 2: Verify code and sign in
      await signIn("sendgrid-otp", { email, code });
      // User setup will be handled by useEffect when currentUser updates
    } catch (error) {
      console.error("Error verifying code:", error);
      alert("Invalid or expired code. Please try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {t("auth.loginTitle")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("auth.loginSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  {t("auth.email")}
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("common.loading") : "Send Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-sm text-muted-foreground text-center mb-4">
                We sent a 6-digit code to <strong>{email}</strong>
              </div>
              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium">
                  Verification Code
                </label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  disabled={loading}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                  {loading ? t("common.loading") : "Verify Code"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                  }}
                  className="w-full"
                  disabled={loading}
                >
                  Use Different Email
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
