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

  const [isAuthenticated, setIsAuthenticated] =
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

            if (pathname === "/login") {
              router.replace("/");
            }

            return;
          }

          setIsAuthenticated(false);
          setIsChecking(false);

          if (pathname !== "/login") {
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
            margin:
              0 0 8px;
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

  return <>{children}</>;
}