"use client";

import {
  ReactNode,
  useEffect,
  useRef,
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

type UserRole =
  | "owner"
  | "editor"
  | "viewer";

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
};

export default function AuthGate({
  children,
}: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();

  const menuRef =
    useRef<HTMLDivElement | null>(null);

  const [isChecking, setIsChecking] =
    useState(true);

  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const isLoginPage =
    pathname === "/login";

  const isOwner =
    profile?.role === "owner";

  useEffect(() => {
    let isActive = true;

    async function loadProfile(
      userId: string
    ) {
      const { data, error } =
        await supabase
          .from("profiles")
          .select(
            "id, full_name, email, role"
          )
          .eq("id", userId)
          .single();

      if (!isActive) {
        return;
      }

      if (error) {
        console.error(
          "Profile loading failed:",
          error
        );

        setProfile(null);
        return;
      }

      setProfile(
        data as UserProfile
      );
    }

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
          setProfile(null);
          setIsChecking(false);

          if (!isLoginPage) {
            router.replace("/login");
          }

          return;
        }

        if (session?.user) {
          setIsAuthenticated(true);

          await loadProfile(
            session.user.id
          );

          if (!isActive) {
            return;
          }

          setIsChecking(false);

          if (isLoginPage) {
            router.replace("/");
          }

          return;
        }

        setIsAuthenticated(false);
        setProfile(null);
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
        setProfile(null);
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
        async (_event, session) => {
          if (!isActive) {
            return;
          }

          if (session?.user) {
            setIsAuthenticated(true);

            await loadProfile(
              session.user.id
            );

            if (!isActive) {
              return;
            }

            setIsChecking(false);

            if (
              pathname === "/login"
            ) {
              router.replace("/");
            }

            return;
          }

          setIsAuthenticated(false);
          setProfile(null);
          setIsChecking(false);
          setIsMenuOpen(false);

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

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setIsMenuOpen(false);
      }
    }

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  function openDashboard() {
    setIsMenuOpen(false);
    router.push("/");
  }

  function openManageAccess() {
    setIsMenuOpen(false);

    if (!isOwner) {
      window.alert(
        "Only the Owner can manage team access."
      );
      return;
    }

    router.push("/manage-access");
  }

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setIsMenuOpen(false);

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
      setProfile(null);

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

  function getUserInitial() {
    const value =
      profile?.full_name?.trim() ||
      profile?.email?.trim() ||
      "User";

    return value
      .charAt(0)
      .toUpperCase();
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (
    isChecking ||
    !isAuthenticated
  ) {
    return (
      <main className="auth-loading-page">
        <div className="auth-loading-card">
          <div className="auth-loading-logo">
            M
          </div>

          <div className="auth-spinner" />

          <h1>MOM Meeting Hub</h1>

          <p>
            Checking secure access...
          </p>
        </div>

        <style jsx>{`
          .auth-loading-page {
            display: grid;
            place-items: center;
            min-height: 100vh;
            padding: 24px;
            color: #edf7ff;
            background:
              radial-gradient(
                circle at 10% 10%,
                rgba(10, 192, 226, 0.23),
                transparent 30%
              ),
              radial-gradient(
                circle at 90% 20%,
                rgba(114, 76, 235, 0.27),
                transparent 32%
              ),
              #050b14;
          }

          .auth-loading-card {
            width: min(100%, 390px);
            padding: 38px;
            text-align: center;
            background:
              rgba(10, 22, 37, 0.92);
            border: 1px solid
              rgba(255, 255, 255, 0.11);
            border-radius: 25px;
            box-shadow:
              0 28px 90px
              rgba(0, 0, 0, 0.55);
          }

          .auth-loading-logo {
            display: grid;
            place-items: center;
            width: 56px;
            height: 56px;
            margin: 0 auto 21px;
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

          .auth-spinner {
            width: 45px;
            height: 45px;
            margin: 0 auto 20px;
            border: 4px solid
              rgba(255, 255, 255, 0.12);
            border-top-color: #168fff;
            border-radius: 50%;
            animation:
              authSpin
              0.75s
              linear
              infinite;
          }

          .auth-loading-card h1 {
            margin: 0 0 8px;
            font-size: 21px;
          }

          .auth-loading-card p {
            margin: 0;
            color: #8499ad;
          }

          @keyframes authSpin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <div className="authenticated-app-shell">
      <div className="protected-app">
        {children}
      </div>

      <div
        className="page-app-menu"
        ref={menuRef}
      >
        <button
          className={`page-menu-button ${
            isMenuOpen
              ? "menu-open"
              : ""
          }`}
          type="button"
          onClick={() =>
            setIsMenuOpen(
              (currentValue) =>
                !currentValue
            )
          }
          aria-label="Open application menu"
          aria-expanded={isMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        {isMenuOpen && (
          <div className="page-menu-dropdown">
            <div className="menu-profile">
              <div className="menu-profile-avatar">
                {getUserInitial()}
              </div>

              <div className="menu-profile-details">
                <strong>
                  {profile?.full_name ||
                    "MOM User"}
                </strong>

                <small>
                  {profile?.email}
                </small>

                <span
                  className={`menu-role ${
                    isOwner
                      ? "owner-role"
                      : ""
                  }`}
                >
                  {profile?.role ||
                    "viewer"}
                </span>
              </div>
            </div>

            <div className="menu-divider" />

            {pathname !== "/" && (
              <button
                className="menu-option"
                type="button"
                onClick={openDashboard}
              >
                <span className="menu-option-icon">
                  H
                </span>

                <span className="menu-option-text">
                  <strong>
                    Dashboard
                  </strong>

                  <small>
                    Return to main dashboard
                  </small>
                </span>
              </button>
            )}

            {isOwner && (
              <button
                className="menu-option"
                type="button"
                onClick={
                  openManageAccess
                }
              >
                <span className="menu-option-icon access-icon">
                  A
                </span>

                <span className="menu-option-text">
                  <strong>
                    Manage Access
                  </strong>

                  <small>
                    Manage team permissions
                  </small>
                </span>
              </button>
            )}

            <div className="menu-divider" />

            <button
              className="menu-option sign-out-option"
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              <span className="menu-option-icon sign-out-icon">
                ↪
              </span>

              <span className="menu-option-text">
                <strong>
                  {isSigningOut
                    ? "Signing Out..."
                    : "Sign Out"}
                </strong>

                <small>
                  End the current session
                </small>
              </span>
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        .authenticated-app-shell {
          position: relative;
          min-height: 100vh;
        }

        .protected-app {
          min-height: 100vh;
        }

        /*
          This menu uses absolute positioning.
          It stays at the top-right of the page,
          but scrolls away with the page.
        */
        .page-app-menu {
          position: absolute;
          z-index: 99999;
          top: 16px;
          right: 16px;
          width: auto;
          height: auto;
        }

        .page-menu-button {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 5px;
          width: 48px;
          height: 48px;
          margin: 0;
          padding: 0;
          color: #ffffff;
          background:
            linear-gradient(
              145deg,
              rgba(16, 35, 54, 0.98),
              rgba(7, 17, 30, 0.98)
            );
          border: 1px solid
            rgba(255, 255, 255, 0.16);
          border-radius: 15px;
          box-shadow:
            0 15px 45px
            rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(20px);
          cursor: pointer;
          transition:
            transform 0.2s ease,
            background 0.2s ease,
            border-color 0.2s ease;
        }

        .page-menu-button:hover,
        .page-menu-button.menu-open {
          background:
            linear-gradient(
              135deg,
              #168fff,
              #5969eb
            );
          border-color:
            rgba(139, 211, 255, 0.62);
          transform: translateY(-2px);
        }

        .page-menu-button span {
          display: block;
          width: 21px;
          height: 2px;
          background: currentColor;
          border-radius: 10px;
          transition:
            transform 0.2s ease,
            opacity 0.2s ease;
        }

        .page-menu-button.menu-open
          span:nth-child(1) {
          transform:
            translateY(7px)
            rotate(45deg);
        }

        .page-menu-button.menu-open
          span:nth-child(2) {
          opacity: 0;
        }

        .page-menu-button.menu-open
          span:nth-child(3) {
          transform:
            translateY(-7px)
            rotate(-45deg);
        }

        .page-menu-dropdown {
          position: absolute;
          z-index: 100000;
          top: calc(100% + 10px);
          right: 0;
          width: 300px;
          max-width: calc(
            100vw - 32px
          );
          padding: 10px;
          overflow: hidden;
          background:
            linear-gradient(
              155deg,
              rgba(18, 38, 57, 0.99),
              rgba(8, 18, 31, 0.99)
            );
          border: 1px solid
            rgba(255, 255, 255, 0.14);
          border-radius: 20px;
          box-shadow:
            0 26px 75px
            rgba(0, 0, 0, 0.68);
          backdrop-filter: blur(24px);
          transform-origin: top right;
          animation:
            openPageMenu 0.18s ease;
        }

        @keyframes openPageMenu {
          from {
            opacity: 0;
            transform:
              translateY(-8px)
              scale(0.96);
          }

          to {
            opacity: 1;
            transform:
              translateY(0)
              scale(1);
          }
        }

        .menu-profile {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 11px;
        }

        .menu-profile-avatar {
          display: grid;
          place-items: center;
          flex: 0 0 43px;
          width: 43px;
          height: 43px;
          color: white;
          background:
            linear-gradient(
              135deg,
              #15bde2,
              #6867ec
            );
          border-radius: 14px;
          font-weight: 900;
        }

        .menu-profile-details {
          min-width: 0;
          flex: 1;
        }

        .menu-profile-details strong,
        .menu-profile-details small {
          display: block;
          overflow-wrap: anywhere;
        }

        .menu-profile-details strong {
          margin-bottom: 4px;
          color: #edf7ff;
          font-size: 13px;
        }

        .menu-profile-details small {
          color: #7e94a8;
          font-size: 10px;
        }

        .menu-role {
          display: inline-flex;
          margin-top: 8px;
          padding: 4px 8px;
          color: #69c5ff;
          background:
            rgba(22, 143, 255, 0.11);
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .menu-role.owner-role {
          color: #64e7aa;
          background:
            rgba(72, 222, 157, 0.1);
        }

        .menu-divider {
          height: 1px;
          margin: 6px 5px;
          background:
            rgba(255, 255, 255, 0.08);
        }

        .menu-option {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          padding: 11px;
          color: #dce9f4;
          background: transparent;
          border: none;
          border-radius: 13px;
          text-align: left;
          cursor: pointer;
          transition:
            color 0.17s ease,
            background 0.17s ease;
        }

        .menu-option:hover {
          color: white;
          background:
            rgba(22, 143, 255, 0.14);
        }

        .menu-option:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .menu-option-icon {
          display: grid;
          place-items: center;
          flex: 0 0 35px;
          width: 35px;
          height: 35px;
          color: #78d9ff;
          background:
            rgba(22, 143, 255, 0.11);
          border-radius: 11px;
          font-size: 13px;
          font-weight: 900;
        }

        .menu-option-icon.access-icon {
          color: #a78bff;
          background:
            rgba(131, 96, 237, 0.12);
        }

        .menu-option-text {
          min-width: 0;
          flex: 1;
        }

        .menu-option-text strong,
        .menu-option-text small {
          display: block;
        }

        .menu-option-text strong {
          margin-bottom: 3px;
          color: inherit;
          font-size: 13px;
        }

        .menu-option-text small {
          color: #748a9e;
          font-size: 10px;
        }

        .sign-out-option {
          color: #ff9ca9;
        }

        .sign-out-option:hover {
          color: white;
          background:
            rgba(224, 57, 81, 0.72);
        }

        .sign-out-icon {
          color: #ff9ca9;
          background:
            rgba(224, 57, 81, 0.1);
        }

        @media (max-width: 600px) {
          .page-app-menu {
            top: 10px;
            right: 10px;
          }

          .page-menu-button {
            width: 44px;
            height: 44px;
            border-radius: 13px;
          }

          .page-menu-dropdown {
            top: calc(100% + 8px);
            width: min(
              290px,
              calc(100vw - 20px)
            );
          }
        }
      `}</style>
    </div>
  );
}