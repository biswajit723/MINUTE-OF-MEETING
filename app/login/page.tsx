'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type AuthMode = 'login' | 'signup';
type MessageType = 'success' | 'error';

export default function LoginPage() {
  const router = useRouter();

  const [authMode, setAuthMode] = useState<AuthMode>('login');

  const [fullName, setFullName] = useState('');

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [rememberEmail, setRememberEmail] = useState(true);

  const [isLoading, setIsLoading] = useState(false);

  const [message, setMessage] = useState('');

  const [messageType, setMessageType] = useState<MessageType>('success');

  useEffect(() => {
    const savedEmail = window.localStorage.getItem('mom-remembered-email');

    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  function showMessage(type: MessageType, text: string) {
    setMessageType(type);
    setMessage(text);
  }

  function clearFormMessages() {
    setMessage('');
  }

  function switchMode(mode: AuthMode) {
    setAuthMode(mode);
    clearFormMessages();
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);

    if (mode === 'login') {
      setFullName('');
    }
  }

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFormMessages();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      showMessage('error', 'Please enter your email address.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      showMessage('error', 'Please enter a valid email address.');
      return;
    }

    if (!password) {
      showMessage('error', 'Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        showMessage('error', error.message);
        return;
      }

      if (!data.session) {
        showMessage('error', 'A valid login session could not be created.');
        return;
      }

      if (rememberEmail) {
        window.localStorage.setItem('mom-remembered-email', normalizedEmail);
      } else {
        window.localStorage.removeItem('mom-remembered-email');
      }

      showMessage('success', 'Login successful. Opening MOM Meeting Hub...');

      window.setTimeout(() => {
        router.replace('/');
        router.refresh();
      }, 500);
    } catch (error) {
      console.error('Login failed:', error);

      showMessage('error', 'Unable to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFormMessages();

    const normalizedEmail = email.trim().toLowerCase();

    if (!fullName.trim()) {
      showMessage('error', 'Please enter your full name.');
      return;
    }

    if (!normalizedEmail) {
      showMessage('error', 'Please enter your email address.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      showMessage('error', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      showMessage('error', 'Password must contain at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      showMessage('error', 'The passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        showMessage('error', error.message);
        return;
      }

      if (data.session) {
        showMessage(
          'success',
          'Account created successfully. Opening the dashboard...'
        );

        window.setTimeout(() => {
          router.replace('/');
          router.refresh();
        }, 500);

        return;
      }

      showMessage(
        'success',
        'Account created. Please confirm your email and then sign in.'
      );

      setAuthMode('login');
      setFullName('');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Account creation failed:', error);

      showMessage('error', 'Unable to create the account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword() {
    clearFormMessages();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      showMessage('error', 'Enter your email address first.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      showMessage('error', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/login`,
        }
      );

      if (error) {
        showMessage('error', error.message);
        return;
      }

      showMessage(
        'success',
        'Password reset instructions have been sent to your email.'
      );
    } catch (error) {
      console.error('Password reset failed:', error);

      showMessage('error', 'Unable to send the password reset email.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <div className="gridBackground" />
      <div className="glow glowOne" />
      <div className="glow glowTwo" />

      <section className="loginShell">
        <section className="brandPanel">
          <div className="brandHeader">
            <div className="logoGroup">
              <div className="logoMark">M</div>

              <div className="logoText">
                <strong>MOM Meeting Hub</strong>

                <span>Meetings with clarity</span>
              </div>
            </div>

            <div className="secureBadge">
              <span className="secureDot" />
              Secure Access
            </div>
          </div>

          <div className="brandContent">
            <p className="eyebrow">SMART MEETING MANAGEMENT</p>

            <h1 className="brandTitle">
              Meet. Decide.
              <span> Deliver.</span>
            </h1>

            <p className="brandDescription">
              Manage date-wise TBMs, review every Information and Action point,
              and keep the entire team aligned from one secure workspace.
            </p>
          </div>

          <div className="featureGrid">
            <div className="featureCard">
              <span className="featureIcon">✓</span>

              <div>
                <strong>Secure roles</strong>

                <small>Owner and Viewer access</small>
              </div>
            </div>

            <div className="featureCard">
              <span className="featureIcon">+</span>

              <div>
                <strong>Add topics</strong>

                <small>Information and Action</small>
              </div>
            </div>

            <div className="featureCard">
              <span className="featureIcon">P</span>

              <div>
                <strong>Pin priorities</strong>

                <small>Important points on top</small>
              </div>
            </div>

            <div className="featureCard">
              <span className="featureIcon">S</span>

              <div>
                <strong>Synchronized data</strong>

                <small>Access from every device</small>
              </div>
            </div>
          </div>
        </section>

        <section className="formPanel">
          <div className="formContent">
            <p className="formKicker">MOM WORKSPACE</p>

            <h2 className="formHeading">
              {authMode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>

            <p className="formDescription">
              {authMode === 'login'
                ? 'Sign in with your authorized account to continue.'
                : 'New accounts start with Viewer access and can add meeting topics.'}
            </p>

            <div className="authTabs">
              <button
                type="button"
                className={authMode === 'login' ? 'authTab active' : 'authTab'}
                onClick={() => switchMode('login')}
              >
                Sign In
              </button>

              <button
                type="button"
                className={authMode === 'signup' ? 'authTab active' : 'authTab'}
                onClick={() => switchMode('signup')}
              >
                Sign Up
              </button>
            </div>

            <form
              className="authForm"
              onSubmit={authMode === 'login' ? handleLogin : handleSignUp}
            >
              {authMode === 'signup' && (
                <div className="formGroup">
                  <label className="formLabel" htmlFor="fullName">
                    Full Name
                  </label>

                  <div className="inputWrapper">
                    <span className="inputIcon">U</span>

                    <input
                      id="fullName"
                      className="formInput"
                      type="text"
                      placeholder="Enter your full name"
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="formGroup">
                <label className="formLabel" htmlFor="email">
                  Email Address
                </label>

                <div className="inputWrapper">
                  <span className="inputIcon">@</span>

                  <input
                    id="email"
                    className="formInput"
                    type="email"
                    placeholder="name@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              <div className="formGroup">
                <label className="formLabel" htmlFor="password">
                  Password
                </label>

                <div className="inputWrapper">
                  <span className="inputIcon">L</span>

                  <input
                    id="password"
                    className="formInput passwordInput"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete={
                      authMode === 'login' ? 'current-password' : 'new-password'
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />

                  <button
                    type="button"
                    className="passwordButton"
                    onClick={() =>
                      setShowPassword((currentValue) => !currentValue)
                    }
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {authMode === 'signup' && (
                <div className="formGroup">
                  <label className="formLabel" htmlFor="confirmPassword">
                    Confirm Password
                  </label>

                  <div className="inputWrapper">
                    <span className="inputIcon">C</span>

                    <input
                      id="confirmPassword"
                      className="formInput passwordInput"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Enter the password again"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                    />

                    <button
                      type="button"
                      className="passwordButton"
                      onClick={() =>
                        setShowConfirmPassword((currentValue) => !currentValue)
                      }
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              {authMode === 'login' && (
                <div className="formOptions">
                  <label className="rememberLabel">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(event) =>
                        setRememberEmail(event.target.checked)
                      }
                    />
                    Remember my email
                  </label>

                  <button
                    type="button"
                    className="forgotButton"
                    disabled={isLoading}
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {message && (
                <div
                  className={
                    messageType === 'success'
                      ? 'message success'
                      : 'message error'
                  }
                  role="alert"
                >
                  <span className="messageIcon">
                    {messageType === 'success' ? '✓' : '!'}
                  </span>

                  <span>{message}</span>
                </div>
              )}

              <button
                className="submitButton"
                type="submit"
                disabled={isLoading}
              >
                {isLoading && <span className="spinner" />}

                {isLoading
                  ? 'Please wait...'
                  : authMode === 'login'
                  ? 'Sign In to MOM Hub'
                  : 'Create Viewer Account'}
              </button>
            </form>

            <div className="accessNote">
              <span className="noteIcon">i</span>

              <span>
                <strong>Viewer accounts</strong> can view TBMs and add
                Information or Action topics. The Owner controls additional TBM
                permissions.
              </span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
