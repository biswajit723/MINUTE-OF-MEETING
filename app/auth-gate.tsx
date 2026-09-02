"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import { supabase } from "../lib/supabase";

type AuthGateProps = {
  children: ReactNode;
};

export default function AuthGate({
  children,
}: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isChecking, setIsChecking] =
    useState(true);

  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);

  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const isLoginPage =
    pathname === "/login";

  useEffect(() => {
    let isActive = true;

    async function checkSession() {
      try {
        const {
          data: { session },
          error,
        } =
          await supabase.auth.getSession();

        if (!isActive) {
          return;
        }

        if (error) {
          console.error(
            "Session check failed:",
            error
          );

          setIsAuthenticated(false);
          setIsChecking(false);

          if (!isLoginPage) {
            router.replace("/login");
          }

          return;
        }

        if (session) {
          setIsAuthenticated(true);
          setIsChecking(false);

          if (isLoginPage) {
            router.replace("/");
          }

          return;
        }

        setIsAuthenticated(false);
        setIsChecking(false);

        if (!isLoginPage) {
          router.replace("/login");
        }
      } catch (error) {
        console.error(
          "Authentication check failed:",
          error
        );

        if (!isActive) {
          return;
        }

        setIsAuthenticated(false);
        setIsChecking(false);

        if (!isLoginPage) {
          router.replace("/login");
        }
      }
    }

    checkSession();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!isActive) {
            return;
          }

          if (session) {
            setIsAuthenticated(true);
            setIsChecking(false);

            if (
              pathname === "/login"
            ) {
              router.replace("/");
            }

            return;
          }

          setIsAuthenticated(false);
          setIsChecking(false);

          if (
            pathname !== "/login"
          ) {
            router.replace("/login");
          }
        }
      );

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [
    isLoginPage,
    pathname,
    router,
  ]);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        window.alert(
          `Sign out failed: ${error.message}`
        );

        setIsSigningOut(false);
        return;
      }

      setIsAuthenticated(false);

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error(
        "Sign out failed:",
        error
      );

      window.alert(
        "Unable to sign out. Please try again."
      );

      setIsSigningOut(false);
    }
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (
    isChecking ||
    !isAuthenticated
  ) {
    return (
      <main className="authGuardPage">
        <div className="authGuardCard">
          <div className="authGuardLogo">
            M
          </div>

          <div className="authGuardSpinner" />

          <h1>
            MOM Meeting Hub
          </h1>

          <p>
            Checking secure access...
          </p>
        </div>

        <style jsx>{`
          .authGuardPage {
            display: grid;
            place-items: center;
            min-height: 100vh;
            padding: 24px;
            color: #edf7ff;
            background:
              radial-gradient(
                circle at 10% 10%,
                rgba(
                  10,
                  192,
                  226,
                  0.23
                ),
                transparent 30%
              ),
              radial-gradient(
                circle at 90% 20%,
                rgba(
                  114,
                  76,
                  235,
                  0.27
                ),
                transparent 32%
              ),
              #050b14;
          }

          .authGuardCard {
            width: min(
              100%,
              390px
            );
            padding: 38px;
            text-align: center;
            background:
              rgba(
                10,
                22,
                37,
                0.92
              );
            border: 1px solid
              rgba(
                255,
                255,
                255,
                0.11
              );
            border-radius: 25px;
            box-shadow:
              0 28px 90px
              rgba(
                0,
                0,
                0,
                0.55
              );
            backdrop-filter:
              blur(20px);
          }

          .authGuardLogo {
            display: grid;
            place-items: center;
            width: 56px;
            height: 56px;
            margin:
              0 auto 21px;
            color: white;
            background:
              linear-gradient(
                135deg,
                #16c9e8,
                #6568ec
              );
            border-radius: 18px;
            font-size: 22px;
            font-weight: 900;
          }

          .authGuardSpinner {
            width: 45px;
            height: 45px;
            margin:
              0 auto 20px;
            border: 4px solid
              rgba(
                255,
                255,
                255,
                0.12
              );
            border-top-color:
              #168fff;
            border-radius: 50%;
            animation:
              authGuardSpin
              0.75s
              linear
              infinite;
          }

          .authGuardCard h1 {
            margin: 0 0 8px;
            font-size: 21px;
          }

          .authGuardCard p {
            margin: 0;
            color: #8499ad;
            font-size: 14px;
          }

          @keyframes authGuardSpin {
            to {
              transform:
                rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <>
      <div className="protectedApp">
        {children}
      </div>

      <button
        className="globalSignOutButton"
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        aria-label="Sign out of MOM Meeting Hub"
      >
        <span className="signOutIcon">
          ↪
        </span>

        <span>
          {isSigningOut
            ? "Signing Out..."
            : "Sign Out"}
        </span>
      </button>

      <style jsx global>{`
        .protectedApp {
          min-height: 100vh;
        }

        .globalSignOutButton {
          position: fixed;
          z-index: 5000;
          top: 20px;
          right: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 45px;
          padding: 11px 17px;
          color: #ffabb5;
          background:
            linear-gradient(
              145deg,
              rgba(
                50,
                20,
                29,
                0.96
              ),
              rgba(
                32,
                15,
                24,
                0.96
              )
            );
          border: 1px solid
            rgba(
              255,
              105,
              125,
              0.3
            );
          border-radius: 14px;
          box-shadow:
            0 14px 38px
            rgba(
              0,
              0,
              0,
              0.42
            );
          backdrop-filter:
            blur(18px);
          font-size: 13px;
          font-weight: 850;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            background 0.2s ease,
            border-color 0.2s ease,
            color 0.2s ease;
        }

        .globalSignOutButton:hover:not(
            :disabled
          ) {
          color: white;
          background:
            linear-gradient(
              135deg,
              #df3f58,
              #a92942
            );
          border-color:
            rgba(
              255,
              153,
              167,
              0.65
            );
          transform:
            translateY(-2px);
        }

        .globalSignOutButton:active:not(
            :disabled
          ) {
          transform:
            translateY(0);
        }

        .globalSignOutButton:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        .signOutIcon {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          color: currentColor;
          background:
            rgba(
              255,
              255,
              255,
              0.07
            );
          border-radius: 8px;
          font-size: 15px;
          font-weight: 900;
        }

        @media (
          max-width: 600px
        ) {
          .globalSignOutButton {
            top: 12px;
            right: 12px;
            min-height: 41px;
            padding:
              9px 12px;
            font-size: 12px;
          }

          .signOutIcon {
            width: 22px;
            height: 22px;
          }
        }
      `}</style>
    </>
  );
}