"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type PointStatus = "Open" | "Completed";
type ActiveTab = "information" | "action" | "attendance";
type UserRole = "owner" | "editor" | "viewer";
type AttendanceStatus = "Present" | "Absent";

type MeetingPoint = {
  id: number;
  text: string;
  addedBy: string;
  addedAt: string;
  status?: PointStatus;
  pinned?: boolean;
  responsiblePerson?: string;
  dueDate?: string;
};

type Attendance = {
  id: number;
  name: string;
  status: AttendanceStatus;
};

type Meeting = {
  id: number;
  serialNumber: number;
  name: string;
  date: string;
  pinned?: boolean;
  information: MeetingPoint[];
  action: MeetingPoint[];
  attendance: Attendance[];
};

type UserPermissions = {
  canDeleteMeetings: boolean;
  canDeleteAllPoints: boolean;
};

type TeamProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const SHARED_STATE_ID = "main";

const initialMeetings: Meeting[] = [
  {
    id: 1,
    serialNumber: 1,
    name: "TBM-1",
    date: new Date().toISOString().slice(0, 10),
    pinned: false,
    information: [],
    action: [],
    attendance: [],
  },
];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatDate(date: string) {
  if (!date) return "Not set";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function dueState(point: MeetingPoint) {
  if (point.status === "Completed" || !point.dueDate) return "normal";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${point.dueDate}T00:00:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "normal";
}

function normalizeMeetings(value: unknown): Meeting[] {
  if (!Array.isArray(value) || value.length === 0) return initialMeetings;
  return (value as Meeting[]).map((meeting, index) => ({
    ...meeting,
    serialNumber: meeting.serialNumber || index + 1,
    information: meeting.information || [],
    action: meeting.action || [],
    attendance: meeting.attendance || [],
  }));
}

export default function Page() {
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [selectedMeetingId, setSelectedMeetingId] = useState(1);
  const [activeTab, setActiveTab] = useState<ActiveTab>("information");
  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [role, setRole] = useState<UserRole>("viewer");
  const [permissions, setPermissions] = useState<UserPermissions>({
    canDeleteMeetings: false,
    canDeleteAllPoints: false,
  });
  const [syncStatus, setSyncStatus] = useState("LOADING");
  const [loaded, setLoaded] = useState(false);
  const skipNextSave = useRef(false);

  const [meetingModal, setMeetingModal] = useState(false);
  const [editMeetingId, setEditMeetingId] = useState<number | null>(null);
  const [meetingName, setMeetingName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");

  const [pointModal, setPointModal] = useState(false);
  const [editingPointId, setEditingPointId] = useState<number | null>(null);
  const [pointText, setPointText] = useState("");
  const [addedBy, setAddedBy] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [attendanceProfileId, setAttendanceProfileId] = useState("");
  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>([]);
  const [currentUserName, setCurrentUserName] = useState("");
  const [openMeetingMenuId, setOpenMeetingMenuId] = useState<number | null>(null);
  const [openPointMenuId, setOpenPointMenuId] = useState<number | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");

  const canModify = role === "owner" || role === "editor" || role === "viewer";
  const canDeleteMeeting = role === "owner" || permissions.canDeleteMeetings;
  const canDeletePoint = role === "owner" || permissions.canDeleteAllPoints;

  const selectedMeeting =
    meetings.find((meeting) => meeting.id === selectedMeetingId) || meetings[0];

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setSyncStatus("SIGN IN REQUIRED");
        setLoaded(true);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, can_delete_meetings, can_delete_all_points, full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      setRole(
        profile?.role === "owner"
          ? "owner"
          : profile?.role === "editor"
            ? "editor"
            : "viewer"
      );
      setPermissions({
        canDeleteMeetings: Boolean(profile?.can_delete_meetings),
        canDeleteAllPoints: Boolean(profile?.can_delete_all_points),
      });

      const signedInName =
        profile?.full_name?.trim() ||
        user.user_metadata?.full_name?.trim() ||
        user.email?.split("@")[0] ||
        "Team Member";
      setCurrentUserName(signedInName);

      const { data: profileList, error: profileListError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });

      if (!profileListError && profileList) {
        setTeamProfiles(profileList as TeamProfile[]);
      }

      const { data, error } = await supabase
        .from("mom_shared_state")
        .select("data")
        .eq("id", SHARED_STATE_ID)
        .maybeSingle();

      if (error) {
        console.error(error);
        setSyncStatus("LOAD FAILED");
        setLoaded(true);
        return;
      }

      const incoming = normalizeMeetings(data?.data);
      skipNextSave.current = Boolean(data?.data);
      setMeetings(incoming);
      setSelectedMeetingId(incoming[0].id);
      setSyncStatus("SYNCED");
      setLoaded(true);
    }

    load();
    const channel = supabase
      .channel("mom-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mom_shared_state",
          filter: `id=eq.${SHARED_STATE_ID}`,
        },
        (payload) => {
          const row = payload.new as { data?: unknown };
          if (!row?.data) return;
          const incoming = normalizeMeetings(row.data);
          skipNextSave.current = true;
          setMeetings(incoming);
          setSelectedMeetingId((current) =>
            incoming.some((meeting) => meeting.id === current)
              ? current
              : incoming[0]?.id || 0
          );
          setSyncStatus("SYNCED");
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!loaded || !canModify) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = window.setTimeout(async () => {
      setSyncStatus("SAVING");
      const { error } = await supabase.from("mom_shared_state").upsert(
        {
          id: SHARED_STATE_ID,
          data: meetings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) {
        console.error(error);
        setSyncStatus("SAVE FAILED");
        return;
      }
      setSyncStatus("SYNCED");
    }, 350);
    return () => window.clearTimeout(timer);
  }, [meetings, loaded, canModify]);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!loaded || !currentUserName || !selectedMeeting) return;

    const alreadyAdded = selectedMeeting.attendance.some(
      (person) => normalizeText(person.name) === normalizeText(currentUserName)
    );

    if (alreadyAdded) return;

    updateSelectedMeeting((meeting) => ({
      ...meeting,
      attendance: [
        ...meeting.attendance,
        {
          id: Date.now(),
          name: currentUserName,
          status: "Present",
        },
      ],
    }));
  }, [loaded, currentUserName, selectedMeetingId]);

  const filteredMeetings = useMemo(() => {
    const query = normalizeText(search);
    return [...meetings]
      .filter((meeting) => {
        const points = [...meeting.information, ...meeting.action];
        const haystack = [
          meeting.name,
          formatDate(meeting.date),
          ...points.flatMap((point) => [
            point.text,
            point.addedBy,
            point.responsiblePerson || "",
            point.dueDate || "",
          ]),
          ...meeting.attendance.map((person) => person.name),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );
  }, [meetings, search]);

  const teamMembers = useMemo(() => {
    if (!selectedMeeting) return [];
    const names = [
      ...selectedMeeting.attendance.map((person) => person.name),
      ...selectedMeeting.information.map((point) => point.addedBy),
      ...selectedMeeting.action.flatMap((point) => [
        point.addedBy,
        point.responsiblePerson || "",
      ]),
    ].filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [selectedMeeting]);

  const displayedPoints = useMemo(() => {
    if (!selectedMeeting || activeTab === "attendance") return [];
    const points =
      activeTab === "information"
        ? selectedMeeting.information
        : selectedMeeting.action;
    const query = normalizeText(search);
    return [...points]
      .filter((point) => {
        if (memberFilter && point.addedBy !== memberFilter) return false;
        if (
          responsibleFilter &&
          point.responsiblePerson !== responsibleFilter
        )
          return false;
        if (statusFilter !== "all" && point.status !== statusFilter) return false;
        if (dueFilter !== "all" && dueState(point) !== dueFilter) return false;
        return [
          point.text,
          point.addedBy,
          point.responsiblePerson || "",
          point.dueDate || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [
    selectedMeeting,
    activeTab,
    search,
    memberFilter,
    responsibleFilter,
    statusFilter,
    dueFilter,
  ]);

  const allActions = meetings.flatMap((meeting) =>
    meeting.action.map((point) => ({ ...point, meetingName: meeting.name }))
  );
  const openActions = allActions.filter((point) => point.status !== "Completed");
  const overdueActions = openActions.filter((point) => dueState(point) === "overdue");
  const dueSoonActions = openActions.filter((point) =>
    ["today", "soon"].includes(dueState(point))
  );

  function updateSelectedMeeting(updater: (meeting: Meeting) => Meeting) {
    setMeetings((current) =>
      current.map((meeting) =>
        meeting.id === selectedMeetingId ? updater(meeting) : meeting
      )
    );
  }

  function openCreateMeeting() {
    setEditMeetingId(null);
    setMeetingName("");
    setMeetingDate(new Date().toISOString().slice(0, 10));
    setMeetingModal(true);
  }

  function openEditMeeting(meeting: Meeting) {
    setEditMeetingId(meeting.id);
    setMeetingName(meeting.name);
    setMeetingDate(meeting.date);
    setMeetingModal(true);
  }

  function saveMeeting() {
    if (!meetingDate) return window.alert("Select a meeting date.");
    if (editMeetingId) {
      setMeetings((current) =>
        current.map((meeting) =>
          meeting.id === editMeetingId
            ? { ...meeting, name: meetingName.trim() || meeting.name, date: meetingDate }
            : meeting
        )
      );
    } else {
      const serial = Math.max(0, ...meetings.map((meeting) => meeting.serialNumber)) + 1;
      const meeting: Meeting = {
        id: Date.now(),
        serialNumber: serial,
        name: meetingName.trim() || `TBM-${serial}`,
        date: meetingDate,
        information: [],
        action: [],
        attendance: [],
      };
      setMeetings((current) => [...current, meeting]);
      setSelectedMeetingId(meeting.id);
    }
    setMeetingModal(false);
  }

  function deleteMeeting(id: number) {
    if (!canDeleteMeeting) return window.alert("No permission to delete TBM.");
    if (!window.confirm("Delete this TBM and all its data?")) return;
    const remaining = meetings.filter((meeting) => meeting.id !== id);
    setMeetings(remaining);
    if (selectedMeetingId === id) setSelectedMeetingId(remaining[0]?.id || 0);
  }

  function openNewPoint() {
    setEditingPointId(null);
    setPointText("");
    setAddedBy("");
    setResponsiblePerson("");
    setDueDate("");
    setPointModal(true);
  }

  function openEditPoint(point: MeetingPoint) {
    setEditingPointId(point.id);
    setPointText(point.text);
    setAddedBy(point.addedBy);
    setResponsiblePerson(point.responsiblePerson || "");
    setDueDate(point.dueDate || "");
    setPointModal(true);
  }

  function savePoint() {
    if (!pointText.trim() || !addedBy.trim()) {
      return window.alert("Added by and point details are required.");
    }
    const key = activeTab === "action" ? "action" : "information";
    updateSelectedMeeting((meeting) => {
      const list = meeting[key];
      if (editingPointId) {
        return {
          ...meeting,
          [key]: list.map((point) =>
            point.id === editingPointId
              ? {
                  ...point,
                  text: pointText.trim(),
                  addedBy: addedBy.trim(),
                  responsiblePerson:
                    key === "action" ? responsiblePerson.trim() : undefined,
                  dueDate: key === "action" ? dueDate : undefined,
                }
              : point
          ),
        };
      }
      const point: MeetingPoint = {
        id: Date.now(),
        text: pointText.trim(),
        addedBy: addedBy.trim(),
        addedAt: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        pinned: false,
        status: key === "action" ? "Open" : undefined,
        responsiblePerson:
          key === "action" ? responsiblePerson.trim() : undefined,
        dueDate: key === "action" ? dueDate : undefined,
      };
      return { ...meeting, [key]: [...list, point] };
    });
    setPointModal(false);
  }

  function mutatePoint(id: number, updater: (point: MeetingPoint) => MeetingPoint) {
    const key = activeTab === "action" ? "action" : "information";
    updateSelectedMeeting((meeting) => ({
      ...meeting,
      [key]: meeting[key].map((point) => (point.id === id ? updater(point) : point)),
    }));
  }

  function deletePoint(id: number) {
    if (!canDeletePoint) return window.alert("No permission to delete points.");
    if (!window.confirm("Delete this point permanently?")) return;
    const key = activeTab === "action" ? "action" : "information";
    updateSelectedMeeting((meeting) => ({
      ...meeting,
      [key]: meeting[key].filter((point) => point.id !== id),
    }));
  }

  function addAttendance() {
    const profile = teamProfiles.find(
      (item) => item.id === attendanceProfileId
    );

    if (!profile) {
      window.alert("Select a team member from the dropdown.");
      return;
    }

    const name =
      profile.full_name?.trim() ||
      profile.email?.split("@")[0] ||
      "Team Member";

    updateSelectedMeeting((meeting) => {
      if (
        meeting.attendance.some(
          (person) => normalizeText(person.name) === normalizeText(name)
        )
      ) {
        return meeting;
      }

      return {
        ...meeting,
        attendance: [
          ...meeting.attendance,
          { id: Date.now(), name, status: "Present" },
        ],
      };
    });

    setAttendanceProfileId("");
  }

  function updateAttendance(id: number, status: AttendanceStatus) {
    updateSelectedMeeting((meeting) => ({
      ...meeting,
      attendance: meeting.attendance.map((person) =>
        person.id === id ? { ...person, status } : person
      ),
    }));
  }

  function removeAttendance(id: number) {
    if (!canDeletePoint) return window.alert("No permission to remove attendance.");
    updateSelectedMeeting((meeting) => ({
      ...meeting,
      attendance: meeting.attendance.filter((person) => person.id !== id),
    }));
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      return window.alert("Notifications are not supported in this browser.");
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      new Notification("MOM Meeting Hub", {
        body: `${overdueActions.length} overdue and ${dueSoonActions.length} due soon action(s).`,
        icon: "/mom-icon.svg",
      });
    }
  }

  function showReminder() {
    const lines = [...overdueActions, ...dueSoonActions]
      .slice(0, 8)
      .map(
        (point) =>
          `${point.meetingName}: ${point.text} | ${point.responsiblePerson || "Unassigned"} | ${formatDate(point.dueDate || "")}`
      );
    window.alert(lines.length ? lines.join("\n\n") : "No overdue or upcoming actions.");
  }

  function generateReport() {
    if (!selectedMeeting) return;
    const escape = (value: string) =>
      value.replace(/[&<>"']/g, (character) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character
      );
    const rows = selectedMeeting.action
      .map(
        (point, index) => `<tr><td>${index + 1}</td><td>${escape(point.text)}</td><td>${escape(point.responsiblePerson || "Unassigned")}</td><td>${escape(formatDate(point.dueDate || ""))}</td><td>${escape(point.status || "Open")}</td></tr>`
      )
      .join("");
    const information = selectedMeeting.information
      .map((point, index) => `<li><strong>${index + 1}.</strong> ${escape(point.text)} <small>(${escape(point.addedBy)})</small></li>`)
      .join("");
    const attendance = selectedMeeting.attendance
      .map((person) => `<li>${escape(person.name)}: ${person.status}</li>`)
      .join("");
    const report = window.open("", "_blank", "width=1000,height=800");
    if (!report) return;
    report.document.write(`<!doctype html><html><head><title>${escape(selectedMeeting.name)} Report</title><style>body{font-family:Arial;padding:32px;color:#18212f}h1{margin-bottom:4px}small{color:#667}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccd3dc;padding:9px;text-align:left}th{background:#edf3f8}section{margin-top:28px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save PDF</button><h1>${escape(selectedMeeting.name)}</h1><p>${escape(formatDate(selectedMeeting.date))}</p><section><h2>Attendance</h2><ul>${attendance || "<li>No attendance recorded</li>"}</ul></section><section><h2>Information Points</h2><ol>${information || "<li>No information points</li>"}</ol></section><section><h2>Action Points</h2><table><thead><tr><th>#</th><th>Action</th><th>Responsible</th><th>Due Date</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No action points</td></tr>'}</tbody></table></section><p><small>Generated ${new Date().toLocaleString("en-GB")}</small></p></body></html>`);
    report.document.close();
  }

  if (!selectedMeeting) {
    return (
      <main className="empty-page">
        <h1>No meeting available</h1>
        <button onClick={openCreateMeeting}>Create your first TBM</button>
      </main>
    );
  }

  return (
    <main className="page">
      <style jsx global>{`
        *{box-sizing:border-box}html,body{margin:0;background:#06101d;color:#eef7ff;font-family:Inter,"Segoe UI",Arial,sans-serif}button,input,select,textarea{font:inherit}.page{min-height:100vh;padding:28px;background:radial-gradient(circle at 7% 3%,rgba(0,194,229,.22),transparent 27%),radial-gradient(circle at 95% 20%,rgba(113,76,235,.25),transparent 30%),#06101d}.container{max-width:1500px;margin:auto}.header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:20px}.eyebrow{color:#5ee8fa;font-size:12px;font-weight:900;letter-spacing:2px}.title{font-size:clamp(38px,5vw,66px);margin:8px 0}.title span{color:#63a9ff}.muted{color:#91a6ba}.actions{display:flex;gap:9px;flex-wrap:wrap}.btn{padding:12px 16px;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:rgba(255,255,255,.07);color:white;font-weight:800;cursor:pointer}.btn.primary{background:linear-gradient(135deg,#159cf0,#6870f4)}.btn.danger{color:#ff9da8}.menu-wrap{position:relative}.dots{width:38px;height:38px;padding:0;font-size:22px}.menu{position:absolute;z-index:50;top:43px;right:0;width:190px;padding:7px;border:1px solid rgba(255,255,255,.13);border-radius:14px;background:#102033;box-shadow:0 18px 45px rgba(0,0,0,.55)}.menu button{display:block;width:100%;padding:10px 11px;border:0;border-radius:9px;background:transparent;color:#e8f3fc;text-align:left;cursor:pointer}.menu button:hover{background:rgba(22,140,255,.17)}.menu button.danger{color:#ff9da8}.menu button.danger:hover{color:white;background:rgba(225,57,80,.7)}.stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:18px}.stat{padding:17px;border:1px solid rgba(255,255,255,.1);border-radius:19px;background:rgba(255,255,255,.05)}.stat small{color:#8ca1b5;font-weight:800}.stat strong{display:block;margin-top:8px;font-size:25px}.layout{display:grid;grid-template-columns:330px minmax(0,1fr);gap:16px}.panel{border:1px solid rgba(255,255,255,.11);border-radius:23px;background:rgba(255,255,255,.05);padding:19px}.search{width:100%;padding:13px;color:white;background:#050d18;border:1px solid rgba(255,255,255,.12);border-radius:12px;outline:none}.history{display:flex;flex-direction:column;gap:9px;margin-top:12px}.history-card{display:flex;gap:8px;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.025)}.history-card.active{border-color:#329fff;background:rgba(22,140,255,.14)}.history-main{flex:1;background:none;border:0;color:white;text-align:left;cursor:pointer}.tiny{padding:7px 9px}.meeting-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.toolbar{display:grid;grid-template-columns:2fr repeat(4,1fr);gap:8px;margin:18px 0}.tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:6px;background:#050b15;border-radius:17px;margin-bottom:17px}.tab{padding:13px;border:0;border-radius:12px;background:rgba(255,255,255,.04);color:#91a5b8;font-weight:900;cursor:pointer}.tab.active{color:white;background:#168cff}.point-list{display:flex;flex-direction:column;gap:11px}.point{display:grid;grid-template-columns:44px 1fr auto;gap:13px;padding:17px;background:rgba(4,15,26,.82);border:1px solid rgba(255,255,255,.09);border-radius:18px}.number{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:rgba(16,193,222,.14);color:#5fe7f8;font-weight:900}.point h3{margin:0 0 9px;font-size:16px;line-height:1.5}.point.completed h3{text-decoration:line-through;color:#71869a}.meta{display:flex;gap:9px;flex-wrap:wrap;color:#8499ad;font-size:12px}.chip{padding:5px 8px;border-radius:999px;background:rgba(22,140,255,.12);color:#77c9ff}.chip.overdue{background:rgba(255,70,91,.14);color:#ff929f}.chip.today{background:rgba(255,181,71,.14);color:#ffc361}.chip.soon{background:rgba(177,118,255,.15);color:#c49bff}.attendance-form{display:flex;gap:8px;margin-bottom:14px}.attendance-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.attendance{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:13px;border:1px solid rgba(255,255,255,.09);border-radius:14px}.modal-bg{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:18px;background:rgba(1,5,10,.88)}.modal{width:100%;max-width:570px;padding:24px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:#0d1b2a}.modal h2{margin-top:0}.field{width:100%;padding:13px;margin:6px 0 13px;color:white;background:#050d18;border:1px solid rgba(255,255,255,.13);border-radius:12px}.empty{padding:55px;text-align:center;color:#8398ab;border:1px dashed rgba(255,255,255,.14);border-radius:17px}.empty-page{min-height:100vh;display:grid;place-items:center;background:#06101d;color:white}.empty-page button{padding:12px}.alert-bar{margin-bottom:14px;padding:13px;border:1px solid rgba(255,190,73,.25);border-radius:14px;background:rgba(255,190,73,.08);color:#ffd78b}@media(max-width:1100px){.stats{grid-template-columns:repeat(3,1fr)}.layout{grid-template-columns:1fr}.toolbar{grid-template-columns:1fr 1fr}}@media(max-width:650px){.page{padding:13px}.header,.meeting-head{flex-direction:column}.stats{grid-template-columns:repeat(2,1fr)}.toolbar{grid-template-columns:1fr}.attendance-list{grid-template-columns:1fr}.point{grid-template-columns:38px 1fr}.point>.actions{grid-column:1/-1}.tabs{font-size:11px}}
      `}</style>
      <div className="container">
        <header className="header">
          <div>
            <div className="eyebrow">MOM MEETING HUB</div>
            <h1 className="title">Meet. Decide. <span>Deliver.</span></h1>
            <p className="muted">Shared meetings, attendance, responsibility, deadlines, reminders and automatic reports.</p>
          </div>
          <div className="actions">
            <button className="btn" onClick={showReminder}>🔔 Reminders</button>
            <button className="btn" onClick={enableNotifications}>
              {notificationPermission === "granted" ? "Notifications On" : "Enable Notifications"}
            </button>
            <button className="btn" onClick={generateReport}>📝 Generate Report</button>
            <button className="btn primary" onClick={openCreateMeeting}>+ Create TBM</button>
          </div>
        </header>

        {(overdueActions.length > 0 || dueSoonActions.length > 0) && (
          <div className="alert-bar">
            ⚠ {overdueActions.length} overdue action(s), {dueSoonActions.length} due today/soon.
          </div>
        )}

        <section className="stats">
          <div className="stat"><small>TBMS</small><strong>{meetings.length}</strong></div>
          <div className="stat"><small>OPEN ACTIONS</small><strong>{openActions.length}</strong></div>
          <div className="stat"><small>OVERDUE</small><strong>{overdueActions.length}</strong></div>
          <div className="stat"><small>DUE SOON</small><strong>{dueSoonActions.length}</strong></div>
          <div className="stat"><small>ATTENDANCE</small><strong>{selectedMeeting.attendance.filter((p) => p.status === "Present").length}</strong></div>
          <div className="stat"><small>{role.toUpperCase()}</small><strong>{syncStatus}</strong></div>
        </section>

        <section className="layout">
          <aside className="panel">
            <h2>TBM History</h2>
            <input className="search" placeholder="Search everything" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="history">
              {filteredMeetings.map((meeting) => (
                <div className={`history-card ${meeting.id === selectedMeetingId ? "active" : ""}`} key={meeting.id}>
                  <button className="history-main" onClick={() => { setSelectedMeetingId(meeting.id); setActiveTab("information"); }}>
                    <strong>{meeting.pinned ? "📌 " : ""}{meeting.name}</strong><br />
                    <small className="muted">{formatDate(meeting.date)} · {meeting.information.length + meeting.action.length} points</small>
                  </button>
                  <div className="menu-wrap">
                    <button className="btn dots" onClick={() => { setOpenPointMenuId(null); setOpenMeetingMenuId((current) => current === meeting.id ? null : meeting.id); }}>⋮</button>
                    {openMeetingMenuId === meeting.id && (
                      <div className="menu">
                        <button onClick={() => { openEditMeeting(meeting); setOpenMeetingMenuId(null); }}>✎ Edit meeting</button>
                        <button onClick={() => { setMeetings((current) => current.map((item) => item.id === meeting.id ? { ...item, pinned: !item.pinned } : item)); setOpenMeetingMenuId(null); }}>{meeting.pinned ? "📌 Unpin meeting" : "📌 Pin meeting"}</button>
                        {canDeleteMeeting && <button className="danger" onClick={() => { deleteMeeting(meeting.id); setOpenMeetingMenuId(null); }}>🗑 Delete meeting</button>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="panel">
            <div className="meeting-head">
              <div><h2>{selectedMeeting.name}</h2><p className="muted">📅 {formatDate(selectedMeeting.date)}</p></div>
              <div className="actions">
                <button className="btn" onClick={() => updateSelectedMeeting((meeting) => ({ ...meeting, pinned: !meeting.pinned }))}>{selectedMeeting.pinned ? "Unpin" : "Pin TBM"}</button>
                {activeTab !== "attendance" && <button className="btn primary" onClick={openNewPoint}>+ Add Point</button>}
              </div>
            </div>

            <div className="toolbar">
              <input className="search" placeholder="Search points, member, responsible..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="search" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}><option value="">All creators</option>{teamMembers.map((name) => <option key={name}>{name}</option>)}</select>
              <select className="search" value={responsibleFilter} onChange={(e) => setResponsibleFilter(e.target.value)}><option value="">All responsible</option>{teamMembers.map((name) => <option key={name}>{name}</option>)}</select>
              <select className="search" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All status</option><option value="Open">Open</option><option value="Completed">Completed</option></select>
              <select className="search" value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}><option value="all">All due dates</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="soon">Due soon</option></select>
            </div>

            <div className="tabs">
              {(["information", "action", "attendance"] as ActiveTab[]).map((tab) => (
                <button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>{tab.toUpperCase()} ({tab === "information" ? selectedMeeting.information.length : tab === "action" ? selectedMeeting.action.length : selectedMeeting.attendance.length})</button>
              ))}
            </div>

            {activeTab === "attendance" ? (
              <div>
                <div className="attendance-form"><select className="search" value={attendanceProfileId} onChange={(e) => setAttendanceProfileId(e.target.value)}><option value="">Select registered team member</option>{teamProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name?.trim() || profile.email?.split("@")[0] || "Team Member"}{profile.email ? ` (${profile.email})` : ""}</option>)}</select><button className="btn primary" onClick={addAttendance}>Add Member</button></div>
                <div className="attendance-list">
                  {selectedMeeting.attendance.map((person) => (
                    <div className="attendance" key={person.id}><strong>{person.name}</strong><div className="actions"><select className="search" value={person.status} onChange={(e) => updateAttendance(person.id, e.target.value as AttendanceStatus)}><option>Present</option><option>Absent</option></select>{canDeletePoint && <button className="btn danger" onClick={() => removeAttendance(person.id)}>Remove</button>}</div></div>
                  ))}
                </div>
              </div>
            ) : displayedPoints.length === 0 ? (
              <div className="empty">No matching {activeTab} points.</div>
            ) : (
              <div className="point-list">
                {displayedPoints.map((point, index) => {
                  const due = dueState(point);
                  return (
                    <article className={`point ${point.status === "Completed" ? "completed" : ""}`} key={point.id}>
                      <div className="number">{index + 1}</div>
                      <div><h3>{point.pinned ? "📌 " : ""}{point.text}</h3><div className="meta"><span>Added by <strong>{point.addedBy}</strong></span><span>{point.addedAt}</span>{activeTab === "action" && <><span className="chip">👤 {point.responsiblePerson || "Unassigned"}</span><span className={`chip ${due}`}>📅 {formatDate(point.dueDate || "")}</span><span className="chip">{point.status}</span></>}</div></div>
                      <div className="menu-wrap">
                        <button className="btn dots" onClick={() => { setOpenMeetingMenuId(null); setOpenPointMenuId((current) => current === point.id ? null : point.id); }}>⋮</button>
                        {openPointMenuId === point.id && (
                          <div className="menu">
                            <button onClick={() => { openEditPoint(point); setOpenPointMenuId(null); }}>✎ Edit point</button>
                            <button onClick={() => { mutatePoint(point.id, (item) => ({ ...item, pinned: !item.pinned })); setOpenPointMenuId(null); }}>{point.pinned ? "📌 Unpin point" : "📌 Pin point"}</button>
                            {activeTab === "action" && <button onClick={() => { mutatePoint(point.id, (item) => ({ ...item, status: item.status === "Completed" ? "Open" : "Completed" })); setOpenPointMenuId(null); }}>{point.status === "Completed" ? "↻ Reopen action" : "✓ Complete action"}</button>}
                            {canDeletePoint && <button className="danger" onClick={() => { deletePoint(point.id); setOpenPointMenuId(null); }}>🗑 Delete point</button>}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>

      {meetingModal && <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && setMeetingModal(false)}><div className="modal"><h2>{editMeetingId ? "Edit TBM" : "Create TBM"}</h2><label>Meeting title</label><input className="field" value={meetingName} onChange={(e) => setMeetingName(e.target.value)} placeholder="Optional title" /><label>Meeting date</label><input className="field" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} /><div className="actions"><button className="btn" onClick={() => setMeetingModal(false)}>Cancel</button><button className="btn primary" onClick={saveMeeting}>Save</button></div></div></div>}

      {pointModal && <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && setPointModal(false)}><div className="modal"><h2>{editingPointId ? "Edit" : "Add"} {activeTab === "action" ? "Action" : "Information"} Point</h2><label>Added by</label><input className="field" list="team-members" value={addedBy} onChange={(e) => setAddedBy(e.target.value)} /><datalist id="team-members">{teamMembers.map((name) => <option key={name} value={name} />)}</datalist><label>Point details</label><textarea className="field" rows={5} value={pointText} onChange={(e) => setPointText(e.target.value)} />{activeTab === "action" && <><label>Responsible person</label><input className="field" list="team-members" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)} /><label>Due date</label><input className="field" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></>}<div className="actions"><button className="btn" onClick={() => setPointModal(false)}>Cancel</button><button className="btn primary" onClick={savePoint}>Save Point</button></div></div></div>}
    </main>
  );
}
