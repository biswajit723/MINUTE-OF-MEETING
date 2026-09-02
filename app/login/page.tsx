"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type AuthMode = "signin" | "signup";
type NoticeType = "success" | "error";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] =
    useState<AuthMode>("signin");

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  const [noticeType, setNoticeType] =
    useState<NoticeType>("success");

  function displayNotice(
    type: NoticeType,
    text: string
  ) {
    setNoticeType(type);
    setNotice(text);
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setNotice("");
    setPassword("");
    setConfirmPassword("");

    if (nextMode === "signin") {
      setFullName("");
    }
  }

  async function handleSignIn(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setNotice("");

    if (!email.trim()) {
      displayNotice(
        "error",
        "Please enter your email address."
      );
      return;
    }

    if (!password) {
      displayNotice(
        "error",
        "Please enter your password."
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (error) {
        displayNotice(
          "error",
          error.message
        );
        return;
      }

      if (!data.session) {
        displayNotice(
          "error",
          "A login session could not be created."
        );
        return;
      }

      displayNotice(
        "success",
        "Login successful. Opening the dashboard..."
      );

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(error);

      displayNotice(
        "error",
        "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setNotice("");

    if (!fullName.trim()) {
      displayNotice(
        "error",
        "Please enter your full name."
      );
      return;
    }

    if (!email.trim()) {
      displayNotice(
        "error",
        "Please enter your email address."
      );
      return;
    }

    if (password.length < 6) {
      displayNotice(
        "error",
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      displayNotice(
        "error",
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

      if (error) {
        displayNotice(
          "error",
          error.message
        );
        return;
      }

      if (data.session) {
        displayNotice(
          "success",
          "Account created successfully."
        );

        router.replace("/");
        router.refresh();
        return;
      }

      displayNotice(
        "success",
        "Account created. Confirm your email and then sign in."
      );

      setMode("signin");
      setFullName("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);

      displayNotice(
        "error",
        "Unable to create the account."
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setNotice("");

    if (!email.trim()) {
      displayNotice(
        "error",
        "Enter your email address first."
      );
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          {
            redirectTo:
              `${window.location.origin}/login`,
          }
        );

      if (error) {
        displayNotice(
          "error",
          error.message
        );
        return;
      }

      displayNotice(
        "success",
        "Password reset instructions have been sent."
      );
    } catch (error) {
      console.error(error);

      displayNotice(
        "error",
        "Unable to send the reset email."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          background: #050b14;
        }

        body {
          font-family: Inter, "Segoe UI",
            Arial, sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        .login-page {
          display: grid;
          place-items: center;
          min-height: 100vh;
          padding: 24px;
          color: #edf7ff;
          background:
            radial-gradient(
              circle at 10% 10%,
              rgba(10, 192, 226, 0.25),
              transparent 30%
            ),
            radial-gradient(
              circle at 90% 20%,
              rgba(114, 76, 235, 0.28),
              transparent 32%
            ),
            #050b14;
        }

        .login-shell {
          display: grid;
          grid-template-columns:
            minmax(0, 1.1fr)
            minmax(380px, 0.9fr);
          width: 100%;
          max-width: 1120px;
          min-height: 650px;
          overflow: hidden;
          background: rgba(7, 16, 28, 0.88);
          border: 1px solid
            rgba(255, 255, 255, 0.11);
          border-radius: 30px;
          box-shadow:
            0 40px 120px
            rgba(0, 0, 0, 0.6);
        }

        .brand-panel {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 50px;
          background:
            linear-gradient(
              145deg,
              rgba(7, 39, 58, 0.96),
              rgba(19, 20, 57, 0.94)
            );
        }

        .logo-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .logo {
          display: grid;
          place-items: center;
          width: 54px;
          height: 54px;
          color: white;
          background:
            linear-gradient(
              135deg,
              #16c9e8,
              #6568ec
            );
          border-radius: 17px;
          font-size: 21px;
          font-weight: 900;
        }

        .logo-copy strong,
        .logo-copy span {
          display: block;
        }

        .logo-copy span {
          margin-top: 4px;
          color: #8da3b7;
          font-size: 12px;
        }

        .eyebrow {
          margin: 0 0 14px;
          color: #5fe7f8;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2.3px;
        }

        .brand-title {
          margin: 0 0 20px;
          font-size: clamp(
            46px,
            5vw,
            72px
          );
          line-height: 0.98;
          letter-spacing: -3px;
        }

        .brand-title span {
          color: transparent;
          background:
            linear-gradient(
              90deg,
              #18cae8,
              #a080ff
            );
          background-clip: text;
          -webkit-background-clip: text;
        }

        .brand-description {
          margin: 0;
          color: #9aafc1;
          line-height: 1.75;
        }

        .feature-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .feature-card {
          padding: 14px;
          color: #b8cbd9;
          background:
            rgba(255, 255, 255, 0.04);
          border: 1px solid
            rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          font-size: 13px;
        }

        .form-panel {
          display: flex;
          align-items: center;
          padding: 45px;
          background:
            rgba(4, 11, 20, 0.94);
        }

        .form-content {
          width: 100%;
          max-width: 410px;
          margin: auto;
        }

        .form-title {
          margin: 0;
          font-size: 33px;
        }

        .form-description {
          margin: 10px 0 24px;
          color: #8297aa;
          line-height: 1.6;
        }

        .auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-bottom: 24px;
          padding: 5px;
          background: #030912;
          border-radius: 15px;
        }

        .auth-tab {
          padding: 12px;
          color: #8094a7;
          background: transparent;
          border: none;
          border-radius: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .auth-tab.active {
          color: white;
          background:
            linear-gradient(
              135deg,
              #168fff,
              #5268e8
            );
        }

        .form-group {
          margin-bottom: 17px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          color: #bdcad5;
          font-size: 13px;
          font-weight: 650;
        }

        .input-wrapper {
          position: relative;
        }

        .form-input {
          width: 100%;
          padding: 14px;
          color: white;
          background:
            rgba(1, 7, 14, 0.8);
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 13px;
          outline: none;
        }

        .password-input {
          padding-right: 70px;
        }

        .form-input:focus {
          border-color:
            rgba(40, 159, 255, 0.82);
          box-shadow:
            0 0 0 3px
            rgba(22, 143, 255, 0.1);
        }

        .password-button {
          position: absolute;
          top: 50%;
          right: 7px;
          padding: 8px;
          color: #7d91a4;
          background: transparent;
          border: none;
          transform: translateY(-50%);
          cursor: pointer;
        }

        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 18px;
        }

        .forgot-button {
          padding: 0;
          color: #55b7ff;
          background: transparent;
          border: none;
          font-size: 12px;
          cursor: pointer;
        }

        .notice {
          margin-bottom: 17px;
          padding: 13px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        }

        .notice.success {
          color: #69e8ad;
          background:
            rgba(63, 220, 148, 0.09);
          border: 1px solid
            rgba(63, 220, 148, 0.2);
        }

        .notice.error {
          color: #ff9ca8;
          background:
            rgba(235, 68, 91, 0.09);
          border: 1px solid
            rgba(235, 68, 91, 0.2);
        }

        .submit-button {
          width: 100%;
          padding: 15px;
          color: white;
          background:
            linear-gradient(
              135deg,
              #159bf0,
              #656cf0
            );
          border: none;
          border-radius: 14px;
          font-weight: 850;
          cursor: pointer;
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .access-note {
          margin-top: 18px;
          padding: 13px;
          color: #7d92a5;
          background:
            rgba(255, 255, 255, 0.03);
          border-radius: 13px;
          font-size: 11px;
          line-height: 1.6;
        }

        @media (max-width: 900px) {
          .login-shell {
            grid-template-columns: 1fr;
            max-width: 620px;
          }

          .brand-panel,
          .form-panel {
            padding: 35px;
          }
        }

        @media (max-width: 520px) {
          .login-page {
            padding: 12px;
          }

          .brand-panel,
          .form-panel {
            padding: 24px;
          }

          .brand-title {
            font-size: 42px;
          }

          .feature-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="login-shell">
        <section className="brand-panel">
          <div className="logo-row">
            <div className="logo">
              M
            </div>

            <div className="logo-copy">
              <strong>
                MOM Meeting Hub
              </strong>

              <span>
                Meetings with clarity
              </span>
            </div>
          </div>

          <div>
            <p className="eyebrow">
              SMART MEETING MANAGEMENT
            </p>

            <h1 className="brand-title">
              Meet. Decide.
              <span> Deliver.</span>
            </h1>

            <p className="brand-description">
              Manage TBMs, Information topics,
              Action points and team permissions
              from one secure workspace.
            </p>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              Secure user access
            </div>

            <div className="feature-card">
              Owner and Viewer roles
            </div>

            <div className="feature-card">
              Add meeting topics
            </div>

            <div className="feature-card">
              Manage team permissions
            </div>
          </div>
        </section>

        <section className="form-panel">
          <div className="form-content">
            <p className="eyebrow">
              MOM WORKSPACE
            </p>

            <h2 className="form-title">
              {mode === "signin"
                ? "Welcome back"
                : "Create an account"}
            </h2>

            <p className="form-description">
              {mode === "signin"
                ? "Sign in with your authorized account."
                : "New accounts start with Viewer access."}
            </p>

            <div className="auth-tabs">
              <button
                type="button"
                className={
                  mode === "signin"
                    ? "auth-tab active"
                    : "auth-tab"
                }
                onClick={() =>
                  changeMode("signin")
                }
              >
                Sign In
              </button>

              <button
                type="button"
                className={
                  mode === "signup"
                    ? "auth-tab active"
                    : "auth-tab"
                }
                onClick={() =>
                  changeMode("signup")
                }
              >
                Sign Up
              </button>
            </div>

            <form
              onSubmit={
                mode === "signin"
                  ? handleSignIn
                  : handleSignUp
              }
            >
              {mode === "signup" && (
                <div className="form-group">
                  <label className="form-label">
                    Full Name
                  </label>

                  <input
                    className="form-input"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(
                        event.target.value
                      )
                    }
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Email Address
                </label>

                <input
                  className="form-input"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Password
                </label>

                <div className="input-wrapper">
                  <input
                    className="form-input password-input"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    className="password-button"
                    onClick={() =>
                      setShowPassword(
                        (current) =>
                          !current
                      )
                    }
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <div className="form-group">
                  <label className="form-label">
                    Confirm Password
                  </label>

                  <input
                    className="form-input"
                    type="password"
                    placeholder="Enter password again"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                  />
                </div>
              )}

              {mode === "signin" && (
                <div className="forgot-row">
                  <button
                    type="button"
                    className="forgot-button"
                    onClick={resetPassword}
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {notice && (
                <div
                  className={`notice ${noticeType}`}
                >
                  {notice}
                </div>
              )}

              <button
                className="submit-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : mode === "signin"
                  ? "Sign In to MOM Hub"
                  : "Create Viewer Account"}
              </button>
            </form>

            <div className="access-note">
              Viewer accounts can view TBMs and
              add Information or Action topics.
              Additional permissions are controlled
              by the Owner.
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}