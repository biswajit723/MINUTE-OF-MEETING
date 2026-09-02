"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Role = "owner" | "editor" | "viewer";
type EditableRole = "editor" | "viewer";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  can_create_meetings: boolean;
  can_edit_meetings: boolean;
  can_delete_meetings: boolean;
  can_pin_meetings: boolean;
  can_edit_all_points: boolean;
  can_delete_all_points: boolean;
  can_pin_all_points: boolean;
};

type Permissions = {
  role: EditableRole;
  createMeeting: boolean;
  editMeeting: boolean;
  deleteMeeting: boolean;
  pinMeeting: boolean;
  editAllPoints: boolean;
  deleteAllPoints: boolean;
  pinAllPoints: boolean;
};

const viewerPermissions: Permissions = {
  role: "viewer",
  createMeeting: false,
  editMeeting: false,
  deleteMeeting: false,
  pinMeeting: false,
  editAllPoints: false,
  deleteAllPoints: false,
  pinAllPoints: false,
};

function makePermissions(
  profile: Profile
): Permissions {
  return {
    role:
      profile.role === "editor"
        ? "editor"
        : "viewer",
    createMeeting:
      Boolean(
        profile.can_create_meetings
      ),
    editMeeting:
      Boolean(
        profile.can_edit_meetings
      ),
    deleteMeeting:
      Boolean(
        profile.can_delete_meetings
      ),
    pinMeeting:
      Boolean(
        profile.can_pin_meetings
      ),
    editAllPoints:
      Boolean(
        profile.can_edit_all_points
      ),
    deleteAllPoints:
      Boolean(
        profile.can_delete_all_points
      ),
    pinAllPoints:
      Boolean(
        profile.can_pin_all_points
      ),
  };
}

export default function ManageAccessPage() {
  const router = useRouter();

  const [owner, setOwner] =
    useState<Profile | null>(null);

  const [users, setUsers] =
    useState<Profile[]>([]);

  const [selectedUserId, setSelectedUserId] =
    useState("");

  const [permissions, setPermissions] =
    useState<Permissions>(
      viewerPermissions
    );

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadData =
    useCallback(async () => {
      setLoading(true);

      try {
        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const {
          data: ownerData,
          error: ownerError,
        } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (ownerError) {
          throw ownerError;
        }

        const ownerProfile =
          ownerData as Profile;

        if (
          ownerProfile.role !== "owner"
        ) {
          router.replace("/");
          return;
        }

        const {
          data: userData,
          error: userError,
        } = await supabase
          .from("profiles")
          .select("*")
          .order("full_name", {
            ascending: true,
          });

        if (userError) {
          throw userError;
        }

        const loadedUsers =
          (userData ||
            []) as Profile[];

        setOwner(ownerProfile);
        setUsers(loadedUsers);

        const firstUser =
          loadedUsers.find(
            (profile) =>
              profile.role !== "owner"
          );

        setSelectedUserId(
          (currentId) => {
            const exists =
              loadedUsers.some(
                (profile) =>
                  profile.id ===
                    currentId &&
                  profile.role !==
                    "owner"
              );

            return exists
              ? currentId
              : firstUser?.id || "";
          }
        );
      } catch (error) {
        console.error(error);

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load users."
        );
      } finally {
        setLoading(false);
      }
    }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedUser =
    users.find(
      (profile) =>
        profile.id === selectedUserId
    ) || null;

  useEffect(() => {
    if (selectedUser) {
      setPermissions(
        makePermissions(selectedUser)
      );
    } else {
      setPermissions(
        viewerPermissions
      );
    }
  }, [selectedUser]);

  const filteredUsers =
    useMemo(() => {
      const value =
        search.trim().toLowerCase();

      return users.filter(
        (profile) => {
          if (
            profile.role === "owner"
          ) {
            return false;
          }

          return (
            profile.full_name
              .toLowerCase()
              .includes(value) ||
            profile.email
              .toLowerCase()
              .includes(value)
          );
        }
      );
    }, [users, search]);

  function grantFullAccess() {
    setPermissions({
      role: "editor",
      createMeeting: true,
      editMeeting: true,
      deleteMeeting: true,
      pinMeeting: true,
      editAllPoints: true,
      deleteAllPoints: true,
      pinAllPoints: true,
    });
  }

  function resetViewerAccess() {
    setPermissions(
      viewerPermissions
    );
  }

  async function savePermissions() {
    if (!selectedUser) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } =
        await supabase
          .from("profiles")
          .update({
            role: permissions.role,
            can_create_meetings:
              permissions.createMeeting,
            can_edit_meetings:
              permissions.editMeeting,
            can_delete_meetings:
              permissions.deleteMeeting,
            can_pin_meetings:
              permissions.pinMeeting,
            can_edit_all_points:
              permissions.editAllPoints,
            can_delete_all_points:
              permissions.deleteAllPoints,
            can_pin_all_points:
              permissions.pinAllPoints,
          })
          .eq(
            "id",
            selectedUser.id
          );

      if (error) {
        throw error;
      }

      setMessage(
        "Permissions saved successfully."
      );

      await loadData();
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save permissions."
      );
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="loading-page">
        <style>{`
          html,
          body {
            margin: 0;
            background: #050b14;
          }

          .loading-page {
            display: grid;
            place-items: center;
            min-height: 100vh;
            color: white;
            background: #050b14;
            font-family:
              Inter,
              Arial,
              sans-serif;
          }
        `}</style>

        Loading team permissions...
      </main>
    );
  }

  return (
    <main className="access-page">
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
          font-family:
            Inter,
            "Segoe UI",
            Arial,
            sans-serif;
        }

        button,
        input,
        select {
          font: inherit;
        }

        .access-page {
          min-height: 100vh;
          padding: 28px;
          color: #edf7ff;
          background:
            radial-gradient(
              circle at 8% 6%,
              rgba(10, 192, 226, 0.22),
              transparent 28%
            ),
            radial-gradient(
              circle at 94% 22%,
              rgba(114, 76, 235, 0.24),
              transparent 32%
            ),
            #06101d;
        }

        .container {
          width: 100%;
          max-width: 1350px;
          margin: auto;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #5ce8fa;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .title {
          margin: 0;
          font-size: clamp(
            36px,
            5vw,
            60px
          );
        }

        .title span {
          color: #49b4ff;
        }

        .description {
          margin: 10px 0 0;
          color: #91a7bb;
        }

        .header-actions {
          display: flex;
          gap: 9px;
        }

        .button {
          padding: 12px 16px;
          color: white;
          background:
            rgba(255, 255, 255, 0.07);
          border: 1px solid
            rgba(255, 255, 255, 0.11);
          border-radius: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .signout {
          color: #ff9ca8;
        }

        .owner-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          padding: 15px 17px;
          background:
            rgba(255, 255, 255, 0.05);
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 17px;
        }

        .owner-bar strong,
        .owner-bar span {
          display: block;
        }

        .owner-bar span {
          margin-top: 4px;
          color: #8196aa;
          font-size: 12px;
        }

        .owner-badge {
          padding: 8px 12px;
          color: #66e8ab !important;
          background:
            rgba(70, 224, 155, 0.1);
          border-radius: 999px;
          font-weight: 900;
        }

        .layout {
          display: grid;
          grid-template-columns:
            340px minmax(0, 1fr);
          gap: 18px;
        }

        .panel {
          padding: 20px;
          background:
            rgba(255, 255, 255, 0.05);
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 23px;
        }

        .panel-title {
          margin: 0 0 14px;
          font-size: 21px;
        }

        .search {
          width: 100%;
          margin-bottom: 13px;
          padding: 13px;
          color: white;
          background: #050d18;
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          outline: none;
        }

        .user-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .user-card {
          width: 100%;
          padding: 14px;
          color: white;
          background:
            rgba(255, 255, 255, 0.03);
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          text-align: left;
          cursor: pointer;
        }

        .user-card.selected {
          background:
            rgba(22, 140, 255, 0.16);
          border-color:
            rgba(70, 174, 255, 0.55);
        }

        .user-card strong,
        .user-card small {
          display: block;
          overflow-wrap: anywhere;
        }

        .user-card small {
          margin-top: 5px;
          color: #8499ad;
        }

        .selected-user {
          margin-bottom: 18px;
          padding-bottom: 18px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .selected-user h2 {
          margin: 0;
        }

        .selected-user p {
          margin: 5px 0 0;
          color: #8499ad;
        }

        .viewer-note {
          margin-bottom: 20px;
          padding: 14px;
          color: #8eabc0;
          background:
            rgba(22, 140, 255, 0.07);
          border-radius: 13px;
          line-height: 1.6;
        }

        .role-select {
          width: 100%;
          margin: 8px 0 22px;
          padding: 13px;
          color: white;
          background: #050d18;
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 12px;
        }

        .role-select option {
          background: #0d1927;
        }

        .section-title {
          margin: 20px 0 10px;
        }

        .permission-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .permission-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px;
          background:
            rgba(255, 255, 255, 0.03);
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          border-radius: 14px;
        }

        .permission-card.active {
          background:
            rgba(22, 140, 255, 0.12);
          border-color:
            rgba(66, 169, 255, 0.36);
        }

        .permission-card strong,
        .permission-card small {
          display: block;
        }

        .permission-card small {
          margin-top: 4px;
          color: #778c9f;
        }

        .permission-card input {
          width: 19px;
          height: 19px;
          accent-color: #168fff;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 23px;
          padding-top: 18px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .full-button {
          color: #76caff;
        }

        .reset-button {
          color: #ff9ca8;
        }

        .save-button {
          color: white;
          background:
            linear-gradient(
              135deg,
              #159bf0,
              #656cf0
            );
          border-color: transparent;
        }

        .message {
          margin-bottom: 15px;
          padding: 13px;
          color: #69e8ad;
          background:
            rgba(63, 220, 148, 0.09);
          border-radius: 12px;
        }

        .empty {
          padding: 50px 20px;
          color: #8195a8;
          text-align: center;
        }

        @media (max-width: 900px) {
          .header {
            align-items: flex-start;
            flex-direction: column;
          }

          .layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .access-page {
            padding: 14px;
          }

          .header-actions {
            width: 100%;
            flex-direction: column;
          }

          .header-actions button {
            width: 100%;
          }

          .permission-grid {
            grid-template-columns: 1fr;
          }

          .actions {
            flex-direction: column;
          }

          .actions button {
            width: 100%;
          }
        }
      `}</style>

      <div className="container">
        <header className="header">
          <div>
            <p className="eyebrow">
              OWNER CONTROL PANEL
            </p>

            <h1 className="title">
              Manage Team
              <span> Access.</span>
            </h1>

            <p className="description">
              Grant or remove TBM and topic
              permissions for team members.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="button"
              onClick={() =>
                router.push("/")
              }
            >
              Back to Dashboard
            </button>

            <button
              className="button signout"
              onClick={signOut}
            >
              Sign Out
            </button>
          </div>
        </header>

        <section className="owner-bar">
          <div>
            <strong>
              {owner?.full_name ||
                "MOM Owner"}
            </strong>

            <span>
              {owner?.email}
            </span>
          </div>

          <span className="owner-badge">
            OWNER
          </span>
        </section>

        <section className="layout">
          <aside className="panel">
            <h2 className="panel-title">
              Team Members
            </h2>

            <input
              className="search"
              placeholder="Search name or email"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

            <div className="user-list">
              {filteredUsers.length === 0 ? (
                <div className="empty">
                  No Viewer or Editor found.
                </div>
              ) : (
                filteredUsers.map(
                  (profile) => (
                    <button
                      key={profile.id}
                      className={
                        profile.id ===
                        selectedUserId
                          ? "user-card selected"
                          : "user-card"
                      }
                      onClick={() =>
                        setSelectedUserId(
                          profile.id
                        )
                      }
                    >
                      <strong>
                        {profile.full_name ||
                          "Team Member"}
                      </strong>

                      <small>
                        {profile.email}
                      </small>
                    </button>
                  )
                )
              )}
            </div>
          </aside>

          <section className="panel">
            {!selectedUser ? (
              <div className="empty">
                Select a user to manage
                permissions.
              </div>
            ) : (
              <>
                <div className="selected-user">
                  <h2>
                    {selectedUser.full_name ||
                      "Team Member"}
                  </h2>

                  <p>
                    {selectedUser.email}
                  </p>
                </div>

                {message && (
                  <div className="message">
                    {message}
                  </div>
                )}

                <div className="viewer-note">
                  Standard Viewer access allows
                  viewing TBMs, adding Information
                  and Action topics, and managing
                  topics created by the same user.
                </div>

                <label>
                  User Role
                </label>

                <select
                  className="role-select"
                  value={permissions.role}
                  onChange={(event) =>
                    setPermissions(
                      (current) => ({
                        ...current,
                        role:
                          event.target
                            .value as
                            EditableRole,
                      })
                    )
                  }
                >
                  <option value="viewer">
                    Viewer
                  </option>

                  <option value="editor">
                    Editor
                  </option>
                </select>

                <h3 className="section-title">
                  TBM Permissions
                </h3>

                <div className="permission-grid">
                  <Permission
                    title="Create TBM"
                    description="Create new meetings"
                    checked={
                      permissions.createMeeting
                    }
                    onChange={() =>
                      setPermissions(
                        (current) => ({
                          ...current,
                          createMeeting:
                            !current.createMeeting,
                        })
                      )
                    }
                  />

                  <Permission
                    title="Edit TBM"
                    description="Edit title and date"
                    checked={
                      permissions.editMeeting
                    }
                    onChange={() =>
                      setPermissions(
                        (current) => ({
                          ...current,
                          editMeeting:
                            !current.editMeeting,
                        })
                      )
                    }
                  />

                  <Permission
                    title="Pin TBM"
                    description="Pin meetings to top"
                    checked={
                      permissions.pinMeeting
                    }
                    onChange={() =>
                      setPermissions(
                        (current) => ({
                          ...current,
                          pinMeeting:
                            !current.pinMeeting,
                        })
                      )
                    }
                  />

                  <Permission
                    title="Delete TBM"
                    description="Delete meetings"
                    checked={
                      permissions.deleteMeeting
                    }
                    onChange={() =>
                      setPermissions(
                        (current) => ({
                          ...current,
                          deleteMeeting:
                            !current.deleteMeeting,
                        })
                      )
                    }
                  />
                </div>

                <h3 className="section-title">
                  Topic Permissions
                </h3>

                <div className="permission-grid">
                  <Permission
                    title="Edit All Topics"
                    description="Edit any user's topic"
                    checked={
                      permissions.editAllPoints
                    }
                    onChange={() =>
                      setPermissions(
                        (current) => ({
                          ...current,
                          editAllPoints:
                            !current.editAllPoints,
                        })
                      )
                    }
                  />

                  <Permission
                    title="Pin All Topics"
                    description="Pin any user's topic"
                    checked={
                      permissions.pinAllPoints
                    }
                    onChange={() =>
                      setPermissions(
                        (current) => ({
                          ...current,
                          pinAllPoints:
                            !current.pinAllPoints,
                        })
                      )
                    }
                  />

                  <Permission
                    title="Delete All Topics"
                    description="Delete any user's topic"
                    checked={
                      permissions.deleteAllPoints
                    }
                    onChange={() =>
                      setPermissions(
                        (current) => ({
                          ...current,
                          deleteAllPoints:
                            !current.deleteAllPoints,
                        })
                      )
                    }
                  />
                </div>

                <div className="actions">
                  <button
                    className="button full-button"
                    onClick={grantFullAccess}
                    disabled={saving}
                  >
                    Grant Full Access
                  </button>

                  <button
                    className="button reset-button"
                    onClick={
                      resetViewerAccess
                    }
                    disabled={saving}
                  >
                    Reset to Viewer
                  </button>

                  <button
                    className="button save-button"
                    onClick={savePermissions}
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Permissions"}
                  </button>
                </div>
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

type PermissionProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
};

function Permission({
  title,
  description,
  checked,
  onChange,
}: PermissionProps) {
  return (
    <label
      className={
        checked
          ? "permission-card active"
          : "permission-card"
      }
    >
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
    </label>
  );
}