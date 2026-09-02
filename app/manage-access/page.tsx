'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type Role = 'owner' | 'editor' | 'viewer';
type EditableRole = 'editor' | 'viewer';
type MessageType = 'success' | 'error';

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
  created_at: string;
  updated_at: string;
};

type Permissions = {
  role: EditableRole;
  can_create_meetings: boolean;
  can_edit_meetings: boolean;
  can_delete_meetings: boolean;
  can_pin_meetings: boolean;
  can_edit_all_points: boolean;
  can_delete_all_points: boolean;
  can_pin_all_points: boolean;
};

const standardViewerPermissions: Permissions = {
  role: 'viewer',
  can_create_meetings: false,
  can_edit_meetings: false,
  can_delete_meetings: false,
  can_pin_meetings: false,
  can_edit_all_points: false,
  can_delete_all_points: false,
  can_pin_all_points: false,
};

function permissionsFromProfile(profile: Profile): Permissions {
  return {
    role: profile.role === 'editor' ? 'editor' : 'viewer',
    can_create_meetings: Boolean(profile.can_create_meetings),
    can_edit_meetings: Boolean(profile.can_edit_meetings),
    can_delete_meetings: Boolean(profile.can_delete_meetings),
    can_pin_meetings: Boolean(profile.can_pin_meetings),
    can_edit_all_points: Boolean(profile.can_edit_all_points),
    can_delete_all_points: Boolean(profile.can_delete_all_points),
    can_pin_all_points: Boolean(profile.can_pin_all_points),
  };
}

function getInitials(profile: Profile | null) {
  if (!profile) {
    return 'U';
  }

  const source =
    profile.full_name.trim() || profile.email.split('@')[0] || 'User';

  const words = source.split(/[\s._-]+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function formatDate(value: string) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ManageAccessPage() {
  const router = useRouter();

  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);

  const [users, setUsers] = useState<Profile[]>([]);

  const [selectedUserId, setSelectedUserId] = useState('');

  const [permissions, setPermissions] = useState<Permissions>(
    standardViewerPermissions
  );

  const [searchText, setSearchText] = useState('');

  const [isLoading, setIsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [message, setMessage] = useState('');

  const [messageType, setMessageType] = useState<MessageType>('success');

  const showMessage = useCallback((type: MessageType, text: string) => {
    setMessageType(type);
    setMessage(text);

    window.setTimeout(() => {
      setMessage('');
    }, 3500);
  }, []);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: currentProfileData, error: currentProfileError } =
        await supabase.from('profiles').select('*').eq('id', user.id).single();

      if (currentProfileError) {
        throw currentProfileError;
      }

      const currentProfile = currentProfileData as Profile;

      if (currentProfile.role !== 'owner') {
        router.replace('/');
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', {
          ascending: true,
        });

      if (profilesError) {
        throw profilesError;
      }

      const loadedUsers = (profilesData || []) as Profile[];

      setOwnerProfile(currentProfile);
      setUsers(loadedUsers);

      setSelectedUserId((currentSelectedId) => {
        const selectedUserStillExists = loadedUsers.some(
          (profile) =>
            profile.id === currentSelectedId && profile.role !== 'owner'
        );

        if (selectedUserStillExists) {
          return currentSelectedId;
        }

        const firstManageableUser = loadedUsers.find(
          (profile) => profile.role !== 'owner'
        );

        return firstManageableUser?.id || '';
      });
    } catch (error) {
      console.error(error);

      showMessage(
        'error',
        error instanceof Error ? error.message : 'Unable to load team members.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [router, showMessage]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const selectedUser =
    users.find((profile) => profile.id === selectedUserId) || null;

  useEffect(() => {
    if (!selectedUser) {
      setPermissions(standardViewerPermissions);
      return;
    }

    setPermissions(permissionsFromProfile(selectedUser));
  }, [selectedUser]);

  const manageableUsers = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return users.filter((profile) => {
      if (profile.role === 'owner') {
        return false;
      }

      return (
        profile.full_name.toLowerCase().includes(search) ||
        profile.email.toLowerCase().includes(search) ||
        profile.role.toLowerCase().includes(search)
      );
    });
  }, [users, searchText]);

  const viewerCount = users.filter(
    (profile) => profile.role === 'viewer'
  ).length;

  const editorCount = users.filter(
    (profile) => profile.role === 'editor'
  ).length;

  const activePermissionCount = [
    permissions.can_create_meetings,
    permissions.can_edit_meetings,
    permissions.can_delete_meetings,
    permissions.can_pin_meetings,
    permissions.can_edit_all_points,
    permissions.can_delete_all_points,
    permissions.can_pin_all_points,
  ].filter(Boolean).length;

  function toggleCreateMeeting() {
    setPermissions((current) => ({
      ...current,
      can_create_meetings: !current.can_create_meetings,
    }));
  }

  function toggleEditMeeting() {
    setPermissions((current) => ({
      ...current,
      can_edit_meetings: !current.can_edit_meetings,
    }));
  }

  function toggleDeleteMeeting() {
    setPermissions((current) => ({
      ...current,
      can_delete_meetings: !current.can_delete_meetings,
    }));
  }

  function togglePinMeeting() {
    setPermissions((current) => ({
      ...current,
      can_pin_meetings: !current.can_pin_meetings,
    }));
  }

  function toggleEditAllTopics() {
    setPermissions((current) => ({
      ...current,
      can_edit_all_points: !current.can_edit_all_points,
    }));
  }

  function toggleDeleteAllTopics() {
    setPermissions((current) => ({
      ...current,
      can_delete_all_points: !current.can_delete_all_points,
    }));
  }

  function togglePinAllTopics() {
    setPermissions((current) => ({
      ...current,
      can_pin_all_points: !current.can_pin_all_points,
    }));
  }

  function changeRole(role: EditableRole) {
    if (role === 'editor') {
      setPermissions({
        role: 'editor',
        can_create_meetings: true,
        can_edit_meetings: true,
        can_delete_meetings: false,
        can_pin_meetings: true,
        can_edit_all_points: true,
        can_delete_all_points: false,
        can_pin_all_points: true,
      });

      return;
    }

    setPermissions((current) => ({
      ...current,
      role: 'viewer',
    }));
  }

  function grantFullAccess() {
    setPermissions({
      role: 'editor',
      can_create_meetings: true,
      can_edit_meetings: true,
      can_delete_meetings: true,
      can_pin_meetings: true,
      can_edit_all_points: true,
      can_delete_all_points: true,
      can_pin_all_points: true,
    });
  }

  function resetForm() {
    if (!selectedUser) {
      setPermissions(standardViewerPermissions);
      return;
    }

    setPermissions(permissionsFromProfile(selectedUser));
  }

  async function savePermissions() {
    if (!selectedUser) {
      showMessage('error', 'Please select a team member.');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: permissions.role,
          can_create_meetings: permissions.can_create_meetings,
          can_edit_meetings: permissions.can_edit_meetings,
          can_delete_meetings: permissions.can_delete_meetings,
          can_pin_meetings: permissions.can_pin_meetings,
          can_edit_all_points: permissions.can_edit_all_points,
          can_delete_all_points: permissions.can_delete_all_points,
          can_pin_all_points: permissions.can_pin_all_points,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (error) {
        throw error;
      }

      showMessage(
        'success',
        `Permissions saved for ${selectedUser.full_name || selectedUser.email}.`
      );

      await loadUsers();
    } catch (error) {
      console.error(error);

      showMessage(
        'error',
        error instanceof Error ? error.message : 'Unable to save permissions.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeExtraAccess() {
    if (!selectedUser) {
      showMessage('error', 'Please select a team member.');
      return;
    }

    const confirmed = window.confirm(
      `Remove all extra permissions from ${
        selectedUser.full_name || selectedUser.email
      }?`
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'viewer',
          can_create_meetings: false,
          can_edit_meetings: false,
          can_delete_meetings: false,
          can_pin_meetings: false,
          can_edit_all_points: false,
          can_delete_all_points: false,
          can_pin_all_points: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (error) {
        throw error;
      }

      showMessage(
        'success',
        'Extra permissions removed. The account is now a standard Viewer.'
      );

      await loadUsers();
    } catch (error) {
      console.error(error);

      showMessage(
        'error',
        error instanceof Error ? error.message : 'Unable to remove access.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();

    router.replace('/login');
    router.refresh();
  }

  if (isLoading) {
    return (
      <main className="access-loading">
        <style>{`
          html,
          body {
            margin: 0;
            background: #050c16;
          }

          .access-loading {
            display: grid;
            place-items: center;
            align-content: center;
            min-height: 100vh;
            color: #91a7bb;
            background:
              radial-gradient(
                circle at 10% 10%,
                rgba(20, 188, 225, 0.2),
                transparent 30%
              ),
              #050c16;
            font-family:
              Inter,
              "Segoe UI",
              Arial,
              sans-serif;
          }

          .access-spinner {
            width: 48px;
            height: 48px;
            margin-bottom: 18px;
            border: 4px solid
              rgba(255, 255, 255, 0.12);
            border-top-color: #168fff;
            border-radius: 50%;
            animation: spinnerAnimation 0.8s linear infinite;
          }

          @keyframes spinnerAnimation {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>

        <div className="access-spinner" />
        <p>Loading team access...</p>
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
          background: #050c16;
        }

        body {
          color: #edf7ff;
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

        button {
          appearance: none;
          -webkit-appearance: none;
        }

        .access-page {
          min-height: 100vh;
          padding: 28px;
          color: #edf7ff;
          background:
            radial-gradient(
              circle at 7% 4%,
              rgba(12, 191, 224, 0.22),
              transparent 28%
            ),
            radial-gradient(
              circle at 94% 24%,
              rgba(106, 69, 225, 0.24),
              transparent 32%
            ),
            #06101d;
        }

        .access-container {
          width: 100%;
          max-width: 1450px;
          margin: auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          margin: 0 0 9px;
          color: #5ce8fa;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2.3px;
        }

        .page-title {
          margin: 0;
          font-size: clamp(
            36px,
            5vw,
            62px
          );
          line-height: 1;
          letter-spacing: -2.5px;
        }

        .page-title span {
          color: transparent;
          background:
            linear-gradient(
              90deg,
              #18c9e7,
              #9b7bff
            );
          background-clip: text;
          -webkit-background-clip: text;
        }

        .description {
          max-width: 760px;
          margin: 12px 0 0;
          color: #91a7bb;
          line-height: 1.65;
        }

        .topbar-buttons {
          display: flex;
          gap: 10px;
        }

        .secondary-button,
        .logout-button,
        .full-button,
        .remove-button,
        .save-button {
          padding: 13px 17px;
          border-radius: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .secondary-button {
          color: #d7e9f7;
          background:
            rgba(255, 255, 255, 0.06);
          border: 1px solid
            rgba(255, 255, 255, 0.11);
        }

        .logout-button,
        .remove-button {
          color: #ff9ca8;
          background:
            rgba(235, 68, 91, 0.08);
          border: 1px solid
            rgba(235, 68, 91, 0.18);
        }

        .full-button {
          color: #75c9ff;
          background:
            rgba(22, 140, 255, 0.09);
          border: 1px solid
            rgba(22, 140, 255, 0.2);
        }

        .save-button {
          color: white;
          background:
            linear-gradient(
              135deg,
              #159bf0,
              #656cf0
            );
          border: 1px solid
            rgba(130, 204, 255, 0.3);
        }

        .secondary-button:disabled,
        .logout-button:disabled,
        .full-button:disabled,
        .remove-button:disabled,
        .save-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .owner-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          padding: 14px 17px;
          background:
            rgba(255, 255, 255, 0.045);
          border: 1px solid
            rgba(255, 255, 255, 0.09);
          border-radius: 17px;
        }

        .identity {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .avatar {
          display: grid;
          place-items: center;
          flex: 0 0 44px;
          width: 44px;
          height: 44px;
          color: white;
          background:
            linear-gradient(
              135deg,
              #18bde3,
              #6d66ec
            );
          border-radius: 14px;
          font-weight: 900;
        }

        .identity-details {
          min-width: 0;
        }

        .identity-details strong,
        .identity-details span {
          display: block;
          overflow-wrap: anywhere;
        }

        .identity-details span {
          margin-top: 4px;
          color: #8196aa;
          font-size: 12px;
        }

        .owner-badge {
          padding: 8px 12px;
          color: #66e8ab;
          background:
            rgba(70, 224, 155, 0.1);
          border: 1px solid
            rgba(70, 224, 155, 0.18);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          padding: 19px;
          background:
            rgba(255, 255, 255, 0.05);
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 21px;
        }

        .stat-card p {
          margin: 0;
          color: #8499ad;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.1px;
        }

        .stat-card h2 {
          margin: 10px 0 0;
          font-size: 32px;
        }

        .green-value {
          color: #5ce7b0;
        }

        .main-layout {
          display: grid;
          grid-template-columns:
            360px minmax(0, 1fr);
          gap: 18px;
        }

        .panel {
          background:
            rgba(255, 255, 255, 0.05);
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          box-shadow:
            0 23px 75px
            rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(16px);
        }

        .users-panel,
        .permissions-panel {
          padding: 20px;
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 15px;
        }

        .panel-heading h2 {
          margin: 0;
          font-size: 21px;
        }

        .panel-heading span {
          padding: 6px 10px;
          color: #5de8f9;
          background:
            rgba(19, 199, 229, 0.1);
          border-radius: 999px;
          font-size: 11px;
        }

        .search-input,
        .role-select {
          width: 100%;
          padding: 13px 14px;
          color: white;
          background:
            rgba(1, 7, 14, 0.76);
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 13px;
          outline: none;
        }

        .search-input {
          margin-bottom: 13px;
        }

        .role-select option {
          color: white;
          background: #0b1725;
        }

        .users-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 650px;
          overflow-y: auto;
        }

        .user-card {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 14px;
          color: white;
          background:
            rgba(255, 255, 255, 0.025);
          border: 1px solid
            rgba(255, 255, 255, 0.075);
          border-radius: 16px;
          text-align: left;
          cursor: pointer;
        }

        .user-card.selected {
          background:
            linear-gradient(
              120deg,
              rgba(22, 140, 255, 0.2),
              rgba(92, 74, 221, 0.14)
            );
          border-color:
            rgba(67, 172, 255, 0.62);
        }

        .user-info {
          min-width: 0;
          flex: 1;
        }

        .user-info strong,
        .user-info small {
          display: block;
          overflow-wrap: anywhere;
        }

        .user-info small {
          margin-top: 4px;
          color: #8196a9;
        }

        .role-tag {
          padding: 5px 8px;
          color: #6fc4ff;
          background:
            rgba(22, 140, 255, 0.1);
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .selected-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .selected-header h2 {
          margin: 0;
        }

        .selected-header p {
          margin: 5px 0 0;
          color: #8398ab;
          overflow-wrap: anywhere;
        }

        .joined-tag {
          padding: 7px 10px;
          color: #8ea3b7;
          background:
            rgba(255, 255, 255, 0.045);
          border-radius: 999px;
          font-size: 10px;
        }

        .viewer-information {
          margin-bottom: 20px;
          padding: 15px;
          color: #8ea3b6;
          background:
            rgba(20, 145, 231, 0.06);
          border: 1px solid
            rgba(45, 156, 235, 0.13);
          border-radius: 15px;
          font-size: 12px;
          line-height: 1.65;
        }

        .viewer-information strong {
          color: #6ec5ff;
        }

        .field-label {
          display: block;
          margin-bottom: 8px;
          color: #bdcad6;
          font-size: 13px;
          font-weight: 750;
        }

        .permission-section {
          margin-top: 23px;
        }

        .permission-section h3 {
          margin: 0 0 5px;
        }

        .section-description {
          margin: 0 0 12px;
          color: #74899c;
          font-size: 11px;
        }

        .permission-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 11px;
        }

        .permission-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 15px;
          background:
            rgba(255, 255, 255, 0.027);
          border: 1px solid
            rgba(255, 255, 255, 0.075);
          border-radius: 16px;
          cursor: pointer;
        }

        .permission-card.enabled {
          background:
            linear-gradient(
              120deg,
              rgba(22, 140, 255, 0.12),
              rgba(92, 74, 221, 0.08)
            );
          border-color:
            rgba(57, 165, 255, 0.38);
        }

        .permission-text {
          min-width: 0;
        }

        .permission-text strong,
        .permission-text small {
          display: block;
        }

        .permission-text strong {
          margin-bottom: 5px;
          font-size: 13px;
        }

        .permission-text small {
          color: #768b9e;
          font-size: 10px;
          line-height: 1.45;
        }

        .switch {
          position: relative;
          flex: 0 0 45px;
          width: 45px;
          height: 25px;
        }

        .switch input {
          position: absolute;
          opacity: 0;
        }

        .switch-track {
          position: absolute;
          inset: 0;
          background: #263647;
          border-radius: 999px;
          transition: 0.2s ease;
        }

        .switch-track::after {
          position: absolute;
          top: 4px;
          left: 4px;
          width: 17px;
          height: 17px;
          content: "";
          background: #91a2b2;
          border-radius: 50%;
          transition: 0.2s ease;
        }

        .switch input:checked +
        .switch-track {
          background:
            linear-gradient(
              135deg,
              #178fff,
              #5d69ec
            );
        }

        .switch input:checked +
        .switch-track::after {
          left: 24px;
          background: white;
        }

        .actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.08);
        }

        .action-group {
          display: flex;
          gap: 9px;
        }

        .empty-state {
          padding: 55px 20px;
          color: #8095a8;
          text-align: center;
          border: 1px dashed
            rgba(255, 255, 255, 0.13);
          border-radius: 17px;
        }

        .message {
          position: fixed;
          z-index: 3000;
          right: 22px;
          bottom: 22px;
          max-width: 430px;
          padding: 14px 17px;
          border-radius: 14px;
          box-shadow:
            0 18px 55px
            rgba(0, 0, 0, 0.55);
        }

        .message.success {
          color: #68e9ad;
          background: #102b26;
          border: 1px solid
            rgba(68, 222, 153, 0.25);
        }

        .message.error {
          color: #ff9faa;
          background: #301820;
          border: 1px solid
            rgba(235, 68, 91, 0.25);
        }

        @media (max-width: 1000px) {
          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .main-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 750px) {
          .access-page {
            padding: 14px;
          }

          .stats-grid,
          .permission-grid {
            grid-template-columns: 1fr;
          }

          .selected-header,
          .actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .action-group {
            width: 100%;
            flex-direction: column;
          }

          .action-group button {
            width: 100%;
          }

          .topbar-buttons {
            width: 100%;
            flex-direction: column;
          }

          .topbar-buttons button {
            width: 100%;
          }
        }
      `}</style>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <div className="access-container">
        <header className="topbar">
          <div>
            <p className="eyebrow">OWNER CONTROL PANEL</p>

            <h1 className="page-title">
              Manage Team
              <span> Access.</span>
            </h1>

            <p className="description">
              Grant or remove TBM and topic permissions for every team member.
            </p>
          </div>

          <div className="topbar-buttons">
            <button
              className="secondary-button"
              onClick={() => router.push('/')}
            >
              Back to Dashboard
            </button>

            <button className="logout-button" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </header>

        <section className="owner-strip">
          <div className="identity">
            <div className="avatar">{getInitials(ownerProfile)}</div>

            <div className="identity-details">
              <strong>{ownerProfile?.full_name || 'MOM Owner'}</strong>

              <span>{ownerProfile?.email}</span>
            </div>
          </div>

          <span className="owner-badge">OWNER</span>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <p>TOTAL USERS</p>
            <h2>{users.length}</h2>
          </div>

          <div className="stat-card">
            <p>VIEWERS</p>
            <h2>{viewerCount}</h2>
          </div>

          <div className="stat-card">
            <p>EDITORS</p>
            <h2>{editorCount}</h2>
          </div>

          <div className="stat-card">
            <p>ACTIVE PERMISSIONS</p>

            <h2 className="green-value">
              {selectedUser ? activePermissionCount : 0}
            </h2>
          </div>
        </section>

        <section className="main-layout">
          <aside className="panel users-panel">
            <div className="panel-heading">
              <h2>Team Members</h2>

              <span>{manageableUsers.length} users</span>
            </div>

            <input
              className="search-input"
              type="text"
              placeholder="Search name or email"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />

            <div className="users-list">
              {manageableUsers.length === 0 ? (
                <div className="empty-state">
                  No Viewer or Editor accounts found.
                </div>
              ) : (
                manageableUsers.map((teamUser) => (
                  <button
                    className={`user-card ${
                      teamUser.id === selectedUserId ? 'selected' : ''
                    }`}
                    key={teamUser.id}
                    onClick={() => setSelectedUserId(teamUser.id)}
                  >
                    <div className="avatar">{getInitials(teamUser)}</div>

                    <div className="user-info">
                      <strong>{teamUser.full_name || 'Team Member'}</strong>

                      <small>{teamUser.email}</small>
                    </div>

                    <span className="role-tag">{teamUser.role}</span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="panel permissions-panel">
            {!selectedUser ? (
              <div className="empty-state">
                Select a team member to manage permissions.
              </div>
            ) : (
              <>
                <div className="selected-header">
                  <div className="identity">
                    <div className="avatar">{getInitials(selectedUser)}</div>

                    <div>
                      <h2>{selectedUser.full_name || 'Team Member'}</h2>

                      <p>{selectedUser.email}</p>
                    </div>
                  </div>

                  <span className="joined-tag">
                    Joined {formatDate(selectedUser.created_at)}
                  </span>
                </div>

                <div className="viewer-information">
                  <strong>Standard Viewer access:</strong> This user can view
                  TBMs, add Information topics, add Action topics, and manage
                  topics created by the same account.
                </div>

                <label className="field-label">User Role</label>

                <select
                  className="role-select"
                  value={permissions.role}
                  onChange={(event) =>
                    changeRole(event.target.value as EditableRole)
                  }
                >
                  <option value="viewer">Viewer</option>

                  <option value="editor">Editor</option>
                </select>

                <section className="permission-section">
                  <h3>TBM Permissions</h3>

                  <p className="section-description">
                    Control meeting creation and modification.
                  </p>

                  <div className="permission-grid">
                    <PermissionSwitch
                      title="Create TBM"
                      description="Create new date-wise meetings."
                      checked={permissions.can_create_meetings}
                      onChange={toggleCreateMeeting}
                    />

                    <PermissionSwitch
                      title="Edit TBM"
                      description="Edit meeting title and date."
                      checked={permissions.can_edit_meetings}
                      onChange={toggleEditMeeting}
                    />

                    <PermissionSwitch
                      title="Pin TBM"
                      description="Pin important meetings to the top."
                      checked={permissions.can_pin_meetings}
                      onChange={togglePinMeeting}
                    />

                    <PermissionSwitch
                      title="Delete TBM"
                      description="Delete meetings and related topics."
                      checked={permissions.can_delete_meetings}
                      onChange={toggleDeleteMeeting}
                    />
                  </div>
                </section>

                <section className="permission-section">
                  <h3>Topic Permissions</h3>

                  <p className="section-description">
                    Control topics created by other users.
                  </p>

                  <div className="permission-grid">
                    <PermissionSwitch
                      title="Edit All Topics"
                      description="Edit any Information or Action topic."
                      checked={permissions.can_edit_all_points}
                      onChange={toggleEditAllTopics}
                    />

                    <PermissionSwitch
                      title="Pin All Topics"
                      description="Pin topics created by any user."
                      checked={permissions.can_pin_all_points}
                      onChange={togglePinAllTopics}
                    />

                    <PermissionSwitch
                      title="Delete All Topics"
                      description="Delete topics created by any user."
                      checked={permissions.can_delete_all_points}
                      onChange={toggleDeleteAllTopics}
                    />
                  </div>
                </section>

                <div className="actions">
                  <div className="action-group">
                    <button
                      className="full-button"
                      onClick={grantFullAccess}
                      disabled={isSaving}
                    >
                      Grant Full Work Access
                    </button>

                    <button
                      className="remove-button"
                      onClick={removeExtraAccess}
                      disabled={isSaving}
                    >
                      Remove Extra Access
                    </button>
                  </div>

                  <div className="action-group">
                    <button
                      className="secondary-button"
                      onClick={resetForm}
                      disabled={isSaving}
                    >
                      Reset Form
                    </button>

                    <button
                      className="save-button"
                      onClick={savePermissions}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save Permissions'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

type PermissionSwitchProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
};

function PermissionSwitch({
  title,
  description,
  checked,
  onChange,
}: PermissionSwitchProps) {
  return (
    <label className={`permission-card ${checked ? 'enabled' : ''}`}>
      <div className="permission-text">
        <strong>{title}</strong>
        <small>{description}</small>
      </div>

      <span className="switch">
        <input type="checkbox" checked={checked} onChange={onChange} />

        <span className="switch-track" />
      </span>
    </label>
  );
}
