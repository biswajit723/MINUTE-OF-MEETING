"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type PointStatus = "Open" | "Completed";
type ActiveTab = "information" | "action";
type UserRole = "owner" | "viewer";

type MeetingPoint = {
  id: number;
  text: string;
  addedBy: string;
  addedAt: string;
  status?: PointStatus;
  pinned?: boolean;
};

type Meeting = {
  id: number;
  serialNumber: number;
  name: string;
  date: string;
  pinned?: boolean;
  information: MeetingPoint[];
  action: MeetingPoint[];
};


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SHARED_STATE_ID = "main";

const initialMeetings: Meeting[] = [
  {
    id: 1,
    serialNumber: 1,
    name: "TBM-1",
    date: "2026-09-02",
    pinned: false,
    information: [
      {
        id: 101,
        text: "Weekly safety briefing completed for all team members.",
        addedBy: "Biswajit Ghosh",
        addedAt: "10:15 AM",
        pinned: false,
      },
      {
        id: 102,
        text: "All team members must follow the updated site safety procedure.",
        addedBy: "Team Member",
        addedAt: "10:20 AM",
        pinned: false,
      },
    ],
    action: [
      {
        id: 103,
        text: "Confirm pending material availability before the next meeting.",
        addedBy: "Team Member",
        addedAt: "10:26 AM",
        status: "Open",
        pinned: false,
      },
    ],
  },
];

function formatDate(date: string) {
  if (!date) {
    return "";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "TM";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export default function Page() {
  const [meetings, setMeetings] =
    useState<Meeting[]>(initialMeetings);

  const [selectedMeetingId, setSelectedMeetingId] =
    useState<number>(1);

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("information");

  const [searchText, setSearchText] =
    useState("");

  const [memberFilter, setMemberFilter] =
    useState("");

  const [
    showMemberSuggestions,
    setShowMemberSuggestions,
  ] = useState(false);

  const [
    showNewMeetingModal,
    setShowNewMeetingModal,
  ] = useState(false);

  const [
    showPointModal,
    setShowPointModal,
  ] = useState(false);

  const [
    showEditMeetingModal,
    setShowEditMeetingModal,
  ] = useState(false);

  const [newMeetingName, setNewMeetingName] =
    useState("");

  const [newMeetingDate, setNewMeetingDate] =
    useState("");

  const [editMeetingId, setEditMeetingId] =
    useState<number | null>(null);

  const [editMeetingName, setEditMeetingName] =
    useState("");

  const [editMeetingDate, setEditMeetingDate] =
    useState("");

  const [memberName, setMemberName] =
    useState("");

  const [pointText, setPointText] =
    useState("");

  const [
    openPointMenuId,
    setOpenPointMenuId,
  ] = useState<number | null>(null);

  const [
    openMeetingMenuId,
    setOpenMeetingMenuId,
  ] = useState<number | null>(null);

  const [
    editingPointId,
    setEditingPointId,
  ] = useState<number | null>(null);

  const [editPointText, setEditPointText] =
    useState("");

  const [dataLoaded, setDataLoaded] = useState(false);
  const [role, setRole] = useState<UserRole>("viewer");
  const [syncStatus, setSyncStatus] = useState("LOADING");
  const skipNextSave = useRef(false);
  const canModify = role === "owner" || role === "viewer";
  const canDelete = role === "owner";

  function normalizeMeetings(value: unknown): Meeting[] {
    if (!Array.isArray(value) || value.length === 0) {
      return initialMeetings;
    }

    return (value as Meeting[]).map((meeting, index) => ({
      ...meeting,
      serialNumber: meeting.serialNumber || index + 1,
      pinned: Boolean(meeting.pinned),
      information: meeting.information || [],
      action: meeting.action || [],
    }));
  }

  useEffect(() => {
    let active = true;

    async function loadSharedData() {
      setSyncStatus("LOADING");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        if (active) {
          setRole("viewer");
          setDataLoaded(true);
          setSyncStatus("SIGN IN REQUIRED");
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const loadedRole: UserRole =
        profile?.role === "owner" ? "owner" : "viewer";

      const { data, error } = await supabase
        .from("mom_shared_state")
        .select("data")
        .eq("id", SHARED_STATE_ID)
        .maybeSingle();

      if (!active) return;

      setRole(loadedRole);

      if (error) {
        console.error(error);
        setSyncStatus("LOAD FAILED");
        setDataLoaded(true);
        return;
      }

      const loadedMeetings = normalizeMeetings(data?.data);
      skipNextSave.current = Boolean(data?.data);
      setMeetings(loadedMeetings);
      setSelectedMeetingId(loadedMeetings[0].id);
      setDataLoaded(true);
      setSyncStatus("SYNCED");
    }

    loadSharedData();

    const channel = supabase
      .channel("mom-shared-state-live")
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
          setSelectedMeetingId((currentId) =>
            incoming.some((meeting) => meeting.id === currentId)
              ? currentId
              : incoming[0].id
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
    if (!dataLoaded || !canModify) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      setSyncStatus("SAVING");

      const { error } = await supabase
        .from("mom_shared_state")
        .upsert(
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
        window.alert(`Save failed: ${error.message}`);
        return;
      }

      setSyncStatus("SYNCED");
    }, 350);

    return () => window.clearTimeout(timer);
  }, [meetings, dataLoaded, canModify]);

  function requireModifyPermission() {
    if (canModify) return true;
    window.alert("You do not have permission to modify this data.");
    closeEveryMenu();
    return false;
  }

  const selectedMeeting =
    meetings.find(
      (meeting) =>
        meeting.id === selectedMeetingId
    ) || meetings[0];

  const filteredMeetings = useMemo(() => {
    const search =
      normalizeText(searchText);

    return [...meetings]
      .filter((meeting) => {
        const name =
          meeting.name.toLowerCase();

        const date =
          formatDate(
            meeting.date
          ).toLowerCase();

        return (
          name.includes(search) ||
          date.includes(search)
        );
      })
      .sort(
        (
          firstMeeting,
          secondMeeting
        ) => {
          const pinDifference =
            Number(
              Boolean(
                secondMeeting.pinned
              )
            ) -
            Number(
              Boolean(
                firstMeeting.pinned
              )
            );

          if (pinDifference !== 0) {
            return pinDifference;
          }

          return (
            new Date(
              secondMeeting.date
            ).getTime() -
            new Date(
              firstMeeting.date
            ).getTime()
          );
        }
      );
  }, [meetings, searchText]);

  const totalPoints = meetings.reduce(
    (total, meeting) =>
      total +
      meeting.information.length +
      meeting.action.length,
    0
  );

  const openActions = meetings.reduce(
    (total, meeting) =>
      total +
      meeting.action.filter(
        (point) =>
          point.status === "Open"
      ).length,
    0
  );

  const teamMembers = useMemo(() => {
    if (!selectedMeeting) {
      return [];
    }

    const allPoints = [
      ...selectedMeeting.information,
      ...selectedMeeting.action,
    ];

    const uniqueMemberMap =
      new Map<string, string>();

    allPoints.forEach((point) => {
      const normalizedName =
        normalizeText(point.addedBy);

      if (
        normalizedName &&
        !uniqueMemberMap.has(
          normalizedName
        )
      ) {
        uniqueMemberMap.set(
          normalizedName,
          point.addedBy.trim()
        );
      }
    });

    return Array.from(
      uniqueMemberMap.values()
    ).sort((firstName, secondName) =>
      firstName.localeCompare(
        secondName
      )
    );
  }, [selectedMeeting]);

  const filteredMemberSuggestions =
    useMemo(() => {
      const search =
        normalizeText(memberFilter);

      if (!search) {
        return teamMembers;
      }

      return teamMembers.filter(
        (name) =>
          normalizeText(name).includes(
            search
          )
      );
    }, [memberFilter, teamMembers]);

  const selectedMemberName =
    useMemo(() => {
      const search =
        normalizeText(memberFilter);

      if (!search) {
        return "";
      }

      const exactMember =
        teamMembers.find(
          (name) =>
            normalizeText(name) === search
        );

      return exactMember || memberFilter.trim();
    }, [memberFilter, teamMembers]);

  const filteredInformationPoints =
    useMemo(() => {
      if (!selectedMeeting) {
        return [];
      }

      const search =
        normalizeText(memberFilter);

      if (!search) {
        return selectedMeeting.information;
      }

      return selectedMeeting.information.filter(
        (point) =>
          normalizeText(
            point.addedBy
          ).includes(search)
      );
    }, [
      memberFilter,
      selectedMeeting,
    ]);

  const filteredActionPoints =
    useMemo(() => {
      if (!selectedMeeting) {
        return [];
      }

      const search =
        normalizeText(memberFilter);

      if (!search) {
        return selectedMeeting.action;
      }

      return selectedMeeting.action.filter(
        (point) =>
          normalizeText(
            point.addedBy
          ).includes(search)
      );
    }, [
      memberFilter,
      selectedMeeting,
    ]);

  const filteredMemberTotal =
    filteredInformationPoints.length +
    filteredActionPoints.length;

  const currentPoints =
    activeTab === "information"
      ? filteredInformationPoints
      : filteredActionPoints;

  const displayedPoints =
    [...currentPoints].sort(
      (
        firstPoint,
        secondPoint
      ) =>
        Number(
          Boolean(
            secondPoint.pinned
          )
        ) -
        Number(
          Boolean(
            firstPoint.pinned
          )
        )
    );

  function closeEveryMenu() {
    setOpenPointMenuId(null);
    setOpenMeetingMenuId(null);
  }

  function selectMeeting(
    meetingId: number
  ) {
    setSelectedMeetingId(meetingId);
    setActiveTab("information");
    setMemberFilter("");
    setShowMemberSuggestions(false);
    setEditingPointId(null);
    setEditPointText("");
    closeEveryMenu();
  }

  function changeTab(
    newTab: ActiveTab
  ) {
    setActiveTab(newTab);
    setEditingPointId(null);
    setEditPointText("");
    closeEveryMenu();
  }

  function selectTeamMember(
    name: string
  ) {
    setMemberFilter(name);
    setShowMemberSuggestions(false);
    setEditingPointId(null);
    setEditPointText("");
    closeEveryMenu();
  }

  function clearMemberFilter() {
    setMemberFilter("");
    setShowMemberSuggestions(false);
    setEditingPointId(null);
    setEditPointText("");
    closeEveryMenu();
  }

  function openNewMeetingModal() {
    if (!requireModifyPermission()) return;
    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    setNewMeetingName("");
    setNewMeetingDate(today);
    setShowNewMeetingModal(true);
    closeEveryMenu();
  }

  function closeNewMeetingModal() {
    setShowNewMeetingModal(false);
    setNewMeetingName("");
    setNewMeetingDate("");
  }

  function createNewMeeting() {
    if (!requireModifyPermission()) return;
    if (!newMeetingDate) {
      window.alert(
        "Please select a meeting date."
      );
      return;
    }

    const highestSerialNumber =
      meetings.reduce(
        (
          highestNumber,
          meeting
        ) =>
          Math.max(
            highestNumber,
            meeting.serialNumber || 0
          ),
        0
      );

    const nextSerialNumber =
      highestSerialNumber + 1;

    const typedMeetingName =
      newMeetingName.trim();

    const finalMeetingName =
      typedMeetingName ||
      `TBM-${nextSerialNumber}`;

    const newMeeting: Meeting = {
      id: Date.now(),
      serialNumber:
        nextSerialNumber,
      name: finalMeetingName,
      date: newMeetingDate,
      pinned: false,
      information: [],
      action: [],
    };

    setMeetings(
      (currentMeetings) => [
        ...currentMeetings,
        newMeeting,
      ]
    );

    setSelectedMeetingId(
      newMeeting.id
    );
    setActiveTab("information");
    setMemberFilter("");
    setNewMeetingName("");
    setNewMeetingDate("");
    setShowNewMeetingModal(false);
  }

  function toggleMeetingMenu(
    meetingId: number
  ) {
    setOpenPointMenuId(null);

    setOpenMeetingMenuId(
      (currentMenuId) =>
        currentMenuId === meetingId
          ? null
          : meetingId
    );
  }

  function openEditMeetingModal(
    meeting: Meeting
  ) {
    if (!requireModifyPermission()) return;
    setEditMeetingId(meeting.id);
    setEditMeetingName(
      meeting.name
    );
    setEditMeetingDate(
      meeting.date
    );
    setShowEditMeetingModal(true);
    closeEveryMenu();
  }

  function closeEditMeetingModal() {
    setShowEditMeetingModal(false);
    setEditMeetingId(null);
    setEditMeetingName("");
    setEditMeetingDate("");
  }

  function saveEditedMeeting() {
    if (!requireModifyPermission()) return;
    if (editMeetingId === null) {
      return;
    }

    if (!editMeetingName.trim()) {
      window.alert(
        "Meeting name cannot be empty."
      );
      return;
    }

    if (!editMeetingDate) {
      window.alert(
        "Please select a meeting date."
      );
      return;
    }

    setMeetings(
      (currentMeetings) =>
        currentMeetings.map(
          (meeting) => {
            if (
              meeting.id !==
              editMeetingId
            ) {
              return meeting;
            }

            return {
              ...meeting,
              name:
                editMeetingName.trim(),
              date: editMeetingDate,
            };
          }
        )
    );

    closeEditMeetingModal();
  }

  function togglePinMeeting(
    meetingId: number
  ) {
    if (!requireModifyPermission()) return;
    setMeetings(
      (currentMeetings) =>
        currentMeetings.map(
          (meeting) => {
            if (
              meeting.id !== meetingId
            ) {
              return meeting;
            }

            return {
              ...meeting,
              pinned:
                !meeting.pinned,
            };
          }
        )
    );

    closeEveryMenu();
  }

  function deleteMeeting(
    meetingId: number
  ) {
    if (!canDelete) {
      window.alert("Viewer access is read-only. Delete is not allowed.");
      closeEveryMenu();
      return;
    }
    if (meetings.length === 1) {
      window.alert(
        "The last TBM cannot be deleted."
      );
      closeEveryMenu();
      return;
    }

    const meetingToDelete =
      meetings.find(
        (meeting) =>
          meeting.id === meetingId
      );

    const shouldDelete =
      window.confirm(
        `Delete ${
          meetingToDelete?.name ||
          "this TBM"
        } and all its points?`
      );

    if (!shouldDelete) {
      closeEveryMenu();
      return;
    }

    const remainingMeetings =
      meetings.filter(
        (meeting) =>
          meeting.id !== meetingId
      );

    setMeetings(
      remainingMeetings
    );

    if (
      selectedMeetingId ===
      meetingId
    ) {
      setSelectedMeetingId(
        remainingMeetings[0].id
      );
      setActiveTab(
        "information"
      );
      setMemberFilter("");
    }

    closeEveryMenu();
  }

  function openPointModal() {
    if (!requireModifyPermission()) return;
    setMemberName(
      selectedMemberName || ""
    );
    setPointText("");
    setShowPointModal(true);
    closeEveryMenu();
  }

  function closePointModal() {
    setShowPointModal(false);
    setMemberName("");
    setPointText("");
  }

  function addNewPoint() {
    if (!requireModifyPermission()) return;
    if (!memberName.trim()) {
      window.alert(
        "Please enter the member name."
      );
      return;
    }

    if (!pointText.trim()) {
      window.alert(
        "Please enter the point details."
      );
      return;
    }

    const currentTime =
      new Date().toLocaleTimeString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

    if (
      activeTab ===
      "information"
    ) {
      const newInformationPoint:
        MeetingPoint = {
          id: Date.now(),
          text: pointText.trim(),
          addedBy:
            memberName.trim(),
          addedAt: currentTime,
          pinned: false,
        };

      setMeetings(
        (currentMeetings) =>
          currentMeetings.map(
            (meeting) => {
              if (
                meeting.id !==
                selectedMeetingId
              ) {
                return meeting;
              }

              return {
                ...meeting,
                information: [
                  ...meeting.information,
                  newInformationPoint,
                ],
              };
            }
          )
      );
    } else {
      const newActionPoint:
        MeetingPoint = {
          id: Date.now(),
          text: pointText.trim(),
          addedBy:
            memberName.trim(),
          addedAt: currentTime,
          status: "Open",
          pinned: false,
        };

      setMeetings(
        (currentMeetings) =>
          currentMeetings.map(
            (meeting) => {
              if (
                meeting.id !==
                selectedMeetingId
              ) {
                return meeting;
              }

              return {
                ...meeting,
                action: [
                  ...meeting.action,
                  newActionPoint,
                ],
              };
            }
          )
      );
    }

    setMemberName("");
    setPointText("");
    setShowPointModal(false);
  }

  function togglePointMenu(
    pointId: number
  ) {
    setOpenMeetingMenuId(null);

    setOpenPointMenuId(
      (currentMenuId) =>
        currentMenuId === pointId
          ? null
          : pointId
    );
  }

  function startEditingPoint(
    pointId: number,
    currentText: string
  ) {
    if (!requireModifyPermission()) return;
    setEditingPointId(pointId);
    setEditPointText(currentText);
    closeEveryMenu();
  }

  function cancelEditingPoint() {
    setEditingPointId(null);
    setEditPointText("");
  }

  function saveEditedPoint(
    pointId: number
  ) {
    if (!requireModifyPermission()) return;
    if (!editPointText.trim()) {
      window.alert(
        "Point details cannot be empty."
      );
      return;
    }

    if (
      activeTab ===
      "information"
    ) {
      setMeetings(
        (currentMeetings) =>
          currentMeetings.map(
            (meeting) => {
              if (
                meeting.id !==
                selectedMeetingId
              ) {
                return meeting;
              }

              return {
                ...meeting,
                information:
                  meeting.information.map(
                    (point) =>
                      point.id ===
                      pointId
                        ? {
                            ...point,
                            text:
                              editPointText.trim(),
                          }
                        : point
                  ),
              };
            }
          )
      );
    } else {
      setMeetings(
        (currentMeetings) =>
          currentMeetings.map(
            (meeting) => {
              if (
                meeting.id !==
                selectedMeetingId
              ) {
                return meeting;
              }

              return {
                ...meeting,
                action:
                  meeting.action.map(
                    (point) =>
                      point.id ===
                      pointId
                        ? {
                            ...point,
                            text:
                              editPointText.trim(),
                          }
                        : point
                  ),
              };
            }
          )
      );
    }

    setEditingPointId(null);
    setEditPointText("");
  }

  function togglePinPoint(
    pointId: number
  ) {
    if (!requireModifyPermission()) return;
    if (
      activeTab ===
      "information"
    ) {
      setMeetings(
        (currentMeetings) =>
          currentMeetings.map(
            (meeting) => {
              if (
                meeting.id !==
                selectedMeetingId
              ) {
                return meeting;
              }

              return {
                ...meeting,
                information:
                  meeting.information.map(
                    (point) =>
                      point.id ===
                      pointId
                        ? {
                            ...point,
                            pinned:
                              !point.pinned,
                          }
                        : point
                  ),
              };
            }
          )
      );
    } else {
      setMeetings(
        (currentMeetings) =>
          currentMeetings.map(
            (meeting) => {
              if (
                meeting.id !==
                selectedMeetingId
              ) {
                return meeting;
              }

              return {
                ...meeting,
                action:
                  meeting.action.map(
                    (point) =>
                      point.id ===
                      pointId
                        ? {
                            ...point,
                            pinned:
                              !point.pinned,
                          }
                        : point
                  ),
              };
            }
          )
      );
    }

    closeEveryMenu();
  }

  function changeActionStatus(
    pointId: number
  ) {
    if (!requireModifyPermission()) return;
    setMeetings(
      (currentMeetings) =>
        currentMeetings.map(
          (meeting) => {
            if (
              meeting.id !==
              selectedMeetingId
            ) {
              return meeting;
            }

            return {
              ...meeting,
              action:
                meeting.action.map(
                  (point) => {
                    if (
                      point.id !==
                      pointId
                    ) {
                      return point;
                    }

                    const updatedStatus:
                      PointStatus =
                      point.status ===
                      "Completed"
                        ? "Open"
                        : "Completed";

                    return {
                      ...point,
                      status:
                        updatedStatus,
                    };
                  }
                ),
            };
          }
        )
    );
  }

  function deletePoint(
    pointId: number
  ) {
    if (!canDelete) {
      window.alert("Viewer access is read-only. Delete is not allowed.");
      closeEveryMenu();
      return;
    }
    const shouldDelete =
      window.confirm(
        "Do you want to permanently delete this point?"
      );

    if (!shouldDelete) {
      closeEveryMenu();
      return;
    }

    if (
      activeTab ===
      "information"
    ) {
      setMeetings(
        (currentMeetings) =>
          currentMeetings.map(
            (meeting) => {
              if (
                meeting.id !==
                selectedMeetingId
              ) {
                return meeting;
              }

              return {
                ...meeting,
                information:
                  meeting.information.filter(
                    (point) =>
                      point.id !==
                      pointId
                  ),
              };
            }
          )
      );
    } else {
      setMeetings(
        (currentMeetings) =>
          currentMeetings.map(
            (meeting) => {
              if (
                meeting.id !==
                selectedMeetingId
              ) {
                return meeting;
              }

              return {
                ...meeting,
                action:
                  meeting.action.filter(
                    (point) =>
                      point.id !==
                      pointId
                  ),
              };
            }
          )
      );
    }

    closeEveryMenu();
  }

  if (!selectedMeeting) {
    return (
      <div className="mom-page">
        <h1>
          No meeting available.
        </h1>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          background: #060d18;
        }

        body {
          color: #edf7ff;
          font-family: Inter, "Segoe UI",
            Arial, sans-serif;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        button {
          appearance: none;
          -webkit-appearance: none;
        }

        .mom-page {
          min-height: 100vh;
          padding: 30px;
          background:
            radial-gradient(
              circle at 8% 5%,
              rgba(9, 192, 224, 0.22),
              transparent 27%
            ),
            radial-gradient(
              circle at 94% 25%,
              rgba(107, 66, 218, 0.28),
              transparent 32%
            ),
            #06101d;
        }

        .mom-container {
          width: 100%;
          max-width: 1450px;
          margin: auto;
        }

        .top-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }

        .eyebrow {
          margin: 0;
          color: #60e8fa;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2.3px;
        }

        .main-title {
          margin: 10px 0 12px;
          font-size: clamp(
            40px,
            5vw,
            68px
          );
          line-height: 1;
          letter-spacing: -2px;
        }

        .main-title span {
          color: transparent;
          background: linear-gradient(
            90deg,
            #11c9e9,
            #9875ff
          );
          background-clip: text;
          -webkit-background-clip: text;
        }

        .description {
          max-width: 760px;
          margin: 0;
          color: #94a9bc;
          line-height: 1.65;
        }

        .primary-button {
          padding: 15px 22px;
          color: white;
          background: linear-gradient(
            135deg,
            #159cf0,
            #6870f4
          );
          border: 1px solid
            rgba(133, 204, 255, 0.3);
          border-radius: 16px;
          box-shadow: 0 13px 34px
            rgba(14, 152, 237, 0.27);
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .primary-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 15px;
          margin-bottom: 20px;
        }

        .stat-card {
          padding: 21px;
          background:
            rgba(255, 255, 255, 0.055);
          border: 1px solid
            rgba(255, 255, 255, 0.11);
          border-radius: 24px;
          backdrop-filter: blur(17px);
        }

        .stat-card p {
          margin: 0;
          color: #8ca0b4;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.2px;
        }

        .stat-card h2 {
          margin: 11px 0 0;
          font-size: 35px;
        }

        .saved-text {
          color: #55e5a3;
          font-size: 27px !important;
        }

        .meeting-layout {
          display: grid;
          grid-template-columns:
            340px minmax(0, 1fr);
          gap: 18px;
        }

        .panel {
          background:
            rgba(255, 255, 255, 0.05);
          border: 1px solid
            rgba(255, 255, 255, 0.11);
          border-radius: 25px;
          box-shadow: 0 24px 80px
            rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(17px);
        }

        .history-panel {
          padding: 20px;
          overflow: visible;
        }

        .history-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .history-heading h2 {
          margin: 0;
        }

        .history-heading span {
          padding: 7px 11px;
          color: #61e7fa;
          background:
            rgba(17, 201, 233, 0.1);
          border-radius: 999px;
          font-size: 12px;
        }

        .search-input {
          width: 100%;
          margin-bottom: 14px;
          padding: 14px 15px;
          color: white;
          background:
            rgba(1, 8, 16, 0.73);
          border: 1px solid
            rgba(255, 255, 255, 0.11);
          border-radius: 14px;
          outline: none;
        }

        .search-input:focus {
          border-color:
            rgba(22, 140, 255, 0.7);
          box-shadow: 0 0 0 3px
            rgba(22, 140, 255, 0.1);
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 11px;
        }

        .meeting-history-card {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 17px;
          background:
            rgba(255, 255, 255, 0.025);
          border: 1px solid
            rgba(255, 255, 255, 0.075);
          border-radius: 19px;
        }

        .meeting-history-card.selected {
          background: linear-gradient(
            120deg,
            rgba(22, 140, 255, 0.2),
            rgba(92, 74, 221, 0.14)
          );
          border-color:
            rgba(59, 168, 255, 0.65);
        }

        .meeting-history-card.pinned {
          box-shadow:
            inset 4px 0 0 #168cff;
        }

        .meeting-history-main {
          min-width: 0;
          flex: 1;
          padding: 0;
          color: white;
          background: transparent;
          border: none;
          text-align: left;
          cursor: pointer;
        }

        .meeting-history-main strong,
        .meeting-history-main small {
          display: block;
        }

        .meeting-history-main strong {
          margin-bottom: 8px;
          font-size: 18px;
          overflow-wrap: anywhere;
        }

        .meeting-history-main small {
          margin-top: 6px;
          color: #8fa4b8;
        }

        .history-pin-label {
          display: inline-flex;
          margin-bottom: 8px;
          padding: 4px 8px;
          color: #5cb5ff;
          background:
            rgba(22, 140, 255, 0.12);
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
        }

        .meeting-panel {
          min-width: 0;
          padding: 25px;
        }

        .meeting-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .meeting-header h2 {
          margin: 0;
          font-size: 34px;
          overflow-wrap: anywhere;
        }

        .meeting-date {
          margin: 8px 0 0;
          color: #91a6ba;
        }

        .add-point-button {
          padding: 14px 22px;
          color: white;
          background: linear-gradient(
            135deg,
            #168cff,
            #6068ed
          );
          border: 1px solid
            rgba(255, 255, 255, 0.18);
          border-radius: 15px;
          font-weight: 850;
          cursor: pointer;
        }

        .member-filter {
          position: relative;
          margin: 22px 0 18px;
          padding: 17px;
          background: linear-gradient(
            120deg,
            rgba(13, 68, 104, 0.24),
            rgba(57, 40, 113, 0.2)
          );
          border: 1px solid
            rgba(72, 173, 255, 0.2);
          border-radius: 19px;
        }

        .member-filter-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
        }

        .member-filter-title {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .member-filter-icon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          color: #73d7ff;
          background:
            rgba(22, 140, 255, 0.13);
          border-radius: 12px;
          font-weight: 900;
        }

        .member-filter-title strong,
        .member-filter-title small {
          display: block;
        }

        .member-filter-title strong {
          margin-bottom: 3px;
          font-size: 14px;
        }

        .member-filter-title small {
          color: #8197aa;
          font-size: 11px;
        }

        .member-result-count {
          padding: 7px 10px;
          color: #71d7ff;
          background:
            rgba(22, 140, 255, 0.1);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .member-search-row {
          display: flex;
          gap: 9px;
        }

        .member-search-wrapper {
          position: relative;
          flex: 1;
        }

        .member-search-input {
          width: 100%;
          padding: 13px 45px 13px 14px;
          color: white;
          background:
            rgba(1, 8, 16, 0.72);
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 13px;
          outline: none;
        }

        .member-search-input:focus {
          border-color:
            rgba(42, 159, 255, 0.75);
          box-shadow: 0 0 0 3px
            rgba(22, 140, 255, 0.1);
        }

        .member-search-symbol {
          position: absolute;
          top: 50%;
          right: 14px;
          color: #668095;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .clear-filter-button {
          padding: 12px 15px;
          color: #c9d9e6;
          background:
            rgba(255, 255, 255, 0.065);
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 13px;
          font-weight: 750;
          cursor: pointer;
        }

        .clear-filter-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .member-suggestions {
          position: absolute;
          z-index: 400;
          top: calc(100% + 7px);
          left: 0;
          right: 0;
          max-height: 250px;
          overflow-y: auto;
          padding: 7px;
          background: #102033;
          border: 1px solid
            rgba(255, 255, 255, 0.13);
          border-radius: 15px;
          box-shadow: 0 22px 65px
            rgba(0, 0, 0, 0.7);
        }

        .member-suggestion {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          padding: 11px;
          color: #dceaf5;
          background: transparent;
          border: none;
          border-radius: 10px;
          text-align: left;
          cursor: pointer;
        }

        .member-suggestion:hover,
        .member-suggestion.selected {
          background:
            rgba(22, 140, 255, 0.17);
        }

        .member-avatar {
          display: grid;
          place-items: center;
          flex: 0 0 34px;
          width: 34px;
          height: 34px;
          color: #6cdbff;
          background:
            rgba(22, 140, 255, 0.12);
          border-radius: 11px;
          font-size: 11px;
          font-weight: 900;
        }

        .member-suggestion-info {
          min-width: 0;
          flex: 1;
        }

        .member-suggestion-info strong,
        .member-suggestion-info small {
          display: block;
        }

        .member-suggestion-info small {
          margin-top: 3px;
          color: #758b9f;
          font-size: 10px;
        }

        .active-member-chip {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 11px;
          padding: 10px 12px;
          color: #bfe7ff;
          background:
            rgba(22, 140, 255, 0.09);
          border: 1px solid
            rgba(22, 140, 255, 0.17);
          border-radius: 12px;
          font-size: 12px;
        }

        .meeting-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 0 0 24px;
          padding: 6px;
          background: #050b15;
          border-radius: 20px;
        }

        .meeting-tab {
          padding: 15px 10px;
          color: #8ea2b6;
          background:
            rgba(255, 255, 255, 0.035);
          border: 1px solid transparent;
          border-radius: 15px;
          font-weight: 900;
          cursor: pointer;
        }

        .meeting-tab.active {
          color: white;
          background: linear-gradient(
            135deg,
            #188fff,
            #176ed7
          );
          border-color:
            rgba(126, 205, 255, 0.5);
          box-shadow: 0 7px 23px
            rgba(22, 140, 255, 0.32);
        }

        .points-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .point-card {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 15px;
          padding: 20px;
          background: linear-gradient(
            120deg,
            rgba(4, 15, 26, 0.84),
            rgba(17, 22, 54, 0.8)
          );
          border: 1px solid
            rgba(255, 255, 255, 0.09);
          border-radius: 22px;
        }

        .point-card.pinned {
          border-color:
            rgba(44, 161, 255, 0.6);
          box-shadow:
            inset 4px 0 0 #168cff;
        }

        .point-number {
          display: grid;
          place-items: center;
          flex: 0 0 48px;
          width: 48px;
          height: 48px;
          color: #5fe7f8;
          background:
            rgba(16, 193, 222, 0.14);
          border-radius: 15px;
          font-size: 21px;
          font-weight: 900;
        }

        .point-content {
          min-width: 0;
          flex: 1;
        }

        .point-text {
          margin: 1px 0 13px;
          color: #e6f2fc;
          font-size: 17px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .point-text.completed {
          color: #708396;
          text-decoration: line-through;
        }

        .pinned-label {
          display: inline-flex;
          margin-bottom: 8px;
          padding: 5px 9px;
          color: #5db4ff;
          background:
            rgba(22, 140, 255, 0.11);
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
        }

        .point-details {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px 13px;
          color: #8297ab;
          font-size: 13px;
        }

        .status-button {
          margin-left: auto;
          padding: 8px 12px;
          border: none;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
        }

        .status-button.open {
          color: #ffc45d;
          background:
            rgba(255, 196, 93, 0.12);
        }

        .status-button.completed {
          color: #55e5a3;
          background:
            rgba(85, 229, 163, 0.12);
        }

        .menu-wrapper {
          position: relative;
          flex: 0 0 auto;
        }

        .three-dot-button {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          padding: 0;
          color: #a9bdd0;
          background:
            rgba(255, 255, 255, 0.055);
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          font-size: 23px;
          cursor: pointer;
        }

        .three-dot-button.open {
          color: white;
          background:
            rgba(22, 140, 255, 0.2);
          border-color:
            rgba(66, 175, 255, 0.5);
        }

        .options-menu {
          position: absolute;
          z-index: 200;
          top: 46px;
          right: 0;
          width: 205px;
          padding: 8px;
          background: linear-gradient(
            150deg,
            #14273a,
            #0d1928
          );
          border: 1px solid
            rgba(255, 255, 255, 0.13);
          border-radius: 16px;
          box-shadow: 0 22px 65px
            rgba(0, 0, 0, 0.7);
        }

        .menu-option {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          padding: 12px;
          color: #dce9f5;
          background: transparent;
          border: none;
          border-radius: 11px;
          text-align: left;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .menu-option:hover {
          color: white;
          background:
            rgba(22, 140, 255, 0.16);
        }

        .menu-option.delete {
          color: #ff9aa7;
        }

        .menu-option.delete:hover {
          color: white;
          background:
            rgba(225, 57, 80, 0.75);
        }

        .menu-icon {
          display: grid;
          place-items: center;
          width: 29px;
          height: 29px;
          background:
            rgba(255, 255, 255, 0.065);
          border-radius: 9px;
        }

        .menu-separator {
          height: 1px;
          margin: 5px 4px;
          background:
            rgba(255, 255, 255, 0.08);
        }

        .edit-textarea,
        .form-field {
          width: 100%;
          padding: 14px 15px;
          color: white;
          background:
            rgba(1, 8, 15, 0.75);
          border: 1px solid
            rgba(255, 255, 255, 0.13);
          border-radius: 14px;
          outline: none;
          resize: vertical;
        }

        .edit-textarea:focus,
        .form-field:focus {
          border-color:
            rgba(22, 140, 255, 0.75);
          box-shadow: 0 0 0 3px
            rgba(22, 140, 255, 0.1);
        }

        .edit-actions {
          display: flex;
          gap: 9px;
          margin-top: 10px;
        }

        .save-button,
        .cancel-button {
          padding: 9px 16px;
          border: none;
          border-radius: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .save-button {
          color: white;
          background: #168cff;
        }

        .cancel-button {
          color: #c5d2de;
          background:
            rgba(255, 255, 255, 0.09);
        }

        .empty-points {
          padding: 70px 20px;
          color: #8195aa;
          text-align: center;
          border: 1px dashed
            rgba(255, 255, 255, 0.14);
          border-radius: 21px;
        }

        .empty-points h3 {
          margin: 0 0 8px;
          color: #dceaf5;
        }

        .empty-points p {
          margin: 0;
        }

        .modal-background {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 20px;
          background:
            rgba(1, 5, 10, 0.88);
          backdrop-filter: blur(9px);
        }

        .modal-box {
          width: 100%;
          max-width: 560px;
          padding: 26px;
          color: #edf7ff;
          background: linear-gradient(
            145deg,
            #0e1e2e,
            #091421
          );
          border: 1px solid
            rgba(255, 255, 255, 0.13);
          border-radius: 25px;
          box-shadow: 0 35px 110px
            rgba(0, 0, 0, 0.75);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .modal-header h2 {
          margin: 8px 0 0;
        }

        .close-button {
          width: 42px;
          height: 42px;
          padding: 0;
          color: white;
          background:
            rgba(255, 255, 255, 0.07);
          border: 1px solid
            rgba(255, 255, 255, 0.09);
          border-radius: 12px;
          font-size: 24px;
          cursor: pointer;
        }

        .form-label {
          display: block;
          margin: 20px 0 8px;
          color: #bdcad6;
          font-size: 14px;
        }

        .form-help {
          margin: 9px 0 0;
          color: #75899c;
          font-size: 12px;
          line-height: 1.5;
        }

        .modal-submit {
          width: 100%;
          margin-top: 20px;
        }

        @media (max-width: 950px) {
          .mom-page {
            padding: 20px;
          }

          .top-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .top-header .primary-button {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .meeting-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .mom-page {
            padding: 14px;
          }

          .main-title {
            font-size: 39px;
          }

          .meeting-panel {
            padding: 17px;
          }

          .meeting-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .add-point-button {
            width: 100%;
          }

          .member-filter-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .member-search-row {
            flex-direction: column;
          }

          .clear-filter-button {
            width: 100%;
          }

          .meeting-tab {
            padding: 13px 5px;
            font-size: 12px;
          }

          .point-card {
            gap: 11px;
            padding: 15px;
          }

          .point-number {
            flex-basis: 42px;
            width: 42px;
            height: 42px;
          }

          .point-details {
            align-items: flex-start;
            flex-direction: column;
          }

          .status-button {
            margin-left: 0;
          }

          .options-menu {
            width: 190px;
          }
        }
      `}</style>

      <div
        className="mom-page"
        onClick={(event) => {
          const element =
            event.target as HTMLElement;

          if (
            !element.closest(
              ".menu-wrapper"
            )
          ) {
            closeEveryMenu();
          }

          if (
            !element.closest(
              ".member-search-wrapper"
            )
          ) {
            setShowMemberSuggestions(
              false
            );
          }
        }}
      >
        <div className="mom-container">
          <header className="top-header">
            <div>
              <p className="eyebrow">
                MOM MEETING HUB
              </p>

              <h1 className="main-title">
                Meet. Decide.
                <span> Deliver.</span>
              </h1>

              <p className="description">
                Create date-wise TBMs,
                review previous meeting
                discussions and track every
                Information and Action point.
              </p>
            </div>

            {canModify && (
              <button
                className="primary-button"
                onClick={openNewMeetingModal}
              >
                + Create New TBM
              </button>
            )}
          </header>

          <section className="stats-grid">
            <div className="stat-card">
              <p>TOTAL TBMS</p>
              <h2>{meetings.length}</h2>
            </div>

            <div className="stat-card">
              <p>ALL POINTS</p>
              <h2>{totalPoints}</h2>
            </div>

            <div className="stat-card">
              <p>OPEN ACTIONS</p>
              <h2>{openActions}</h2>
            </div>

            <div className="stat-card">
              <p>DATA STATUS</p>
              <h2 className="saved-text">
                {syncStatus}
              </h2>
              <small>{role.toUpperCase()}</small>
            </div>
          </section>

          <section className="meeting-layout">
            <aside className="panel history-panel">
              <div className="history-heading">
                <h2>TBM History</h2>
                <span>Date-wise</span>
              </div>

              <input
                className="search-input"
                type="text"
                placeholder="Search TBM or date"
                value={searchText}
                onChange={(event) =>
                  setSearchText(
                    event.target.value
                  )
                }
              />

              <div className="history-list">
                {filteredMeetings.map(
                  (meeting) => (
                    <div
                      className={`meeting-history-card ${
                        meeting.id ===
                        selectedMeetingId
                          ? "selected"
                          : ""
                      } ${
                        meeting.pinned
                          ? "pinned"
                          : ""
                      }`}
                      key={meeting.id}
                    >
                      <button
                        className="meeting-history-main"
                        onClick={() =>
                          selectMeeting(
                            meeting.id
                          )
                        }
                      >
                        {meeting.pinned && (
                          <span className="history-pin-label">
                            📌 PINNED
                          </span>
                        )}

                        <strong>
                          {meeting.name}
                        </strong>

                        <small>
                          {formatDate(
                            meeting.date
                          )}
                        </small>

                        <small>
                          {meeting.information
                            .length +
                            meeting.action
                              .length}{" "}
                          total points
                        </small>
                      </button>

                      {canModify && (
                      <div className="menu-wrapper">
                        <button
                          className={`three-dot-button ${
                            openMeetingMenuId ===
                            meeting.id
                              ? "open"
                              : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();

                            toggleMeetingMenu(
                              meeting.id
                            );
                          }}
                        >
                          ⋮
                        </button>

                        {openMeetingMenuId ===
                          meeting.id && (
                          <div
                            className="options-menu"
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                          >
                            <button
                              className="menu-option"
                              onClick={() =>
                                openEditMeetingModal(
                                  meeting
                                )
                              }
                            >
                              <span className="menu-icon">
                                ✎
                              </span>
                              <span>
                                Edit meeting
                              </span>
                            </button>

                            <button
                              className="menu-option"
                              onClick={() =>
                                togglePinMeeting(
                                  meeting.id
                                )
                              }
                            >
                              <span className="menu-icon">
                                📌
                              </span>
                              <span>
                                {meeting.pinned
                                  ? "Unpin meeting"
                                  : "Pin to top"}
                              </span>
                            </button>

                            <div className="menu-separator" />

                            {canDelete && (
                              <button
                                className="menu-option delete"
                                onClick={() =>
                                  deleteMeeting(
                                    meeting.id
                                  )
                                }
                              >
                                <span className="menu-icon">
                                  🗑
                                </span>
                                <span>
                                  Delete meeting
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </aside>

            <main className="panel meeting-panel">
              <div className="meeting-header">
                <div>
                  <h2>
                    {selectedMeeting.name}
                  </h2>

                  <p className="meeting-date">
                    📅{" "}
                    {formatDate(
                      selectedMeeting.date
                    )}
                  </p>
                </div>

                {canModify && (
                  <button
                    className="add-point-button"
                    onClick={openPointModal}
                  >
                    + Add Point
                  </button>
                )}
              </div>

              <section className="member-filter">
                <div className="member-filter-heading">
                  <div className="member-filter-title">
                    <span className="member-filter-icon">
                      TM
                    </span>

                    <div>
                      <strong>
                        Team Member Filter
                      </strong>

                      <small>
                        Filter points by the
                        member who added them
                      </small>
                    </div>
                  </div>

                  <span className="member-result-count">
                    {memberFilter
                      ? `${filteredMemberTotal} matching points`
                      : `${teamMembers.length} team members`}
                  </span>
                </div>

                <div className="member-search-row">
                  <div className="member-search-wrapper">
                    <input
                      className="member-search-input"
                      type="text"
                      placeholder="Type or select a team member"
                      value={memberFilter}
                      autoComplete="off"
                      onFocus={() =>
                        setShowMemberSuggestions(
                          true
                        )
                      }
                      onChange={(event) => {
                        setMemberFilter(
                          event.target.value
                        );

                        setShowMemberSuggestions(
                          true
                        );
                      }}
                    />

                    <span className="member-search-symbol">
                      ⌕
                    </span>

                    {showMemberSuggestions && (
                      <div className="member-suggestions">
                        <button
                          className={`member-suggestion ${
                            !memberFilter
                              ? "selected"
                              : ""
                          }`}
                          onClick={
                            clearMemberFilter
                          }
                        >
                          <span className="member-avatar">
                            ALL
                          </span>

                          <span className="member-suggestion-info">
                            <strong>
                              All Team Members
                            </strong>

                            <small>
                              Show every point
                            </small>
                          </span>
                        </button>

                        {filteredMemberSuggestions.map(
                          (name) => {
                            const memberPointCount =
                              [
                                ...selectedMeeting.information,
                                ...selectedMeeting.action,
                              ].filter(
                                (point) =>
                                  normalizeText(
                                    point.addedBy
                                  ) ===
                                  normalizeText(
                                    name
                                  )
                              ).length;

                            return (
                              <button
                                className={`member-suggestion ${
                                  normalizeText(
                                    memberFilter
                                  ) ===
                                  normalizeText(
                                    name
                                  )
                                    ? "selected"
                                    : ""
                                }`}
                                key={name}
                                onClick={() =>
                                  selectTeamMember(
                                    name
                                  )
                                }
                              >
                                <span className="member-avatar">
                                  {getInitials(
                                    name
                                  )}
                                </span>

                                <span className="member-suggestion-info">
                                  <strong>
                                    {name}
                                  </strong>

                                  <small>
                                    {
                                      memberPointCount
                                    }{" "}
                                    added points
                                  </small>
                                </span>
                              </button>
                            );
                          }
                        )}

                        {filteredMemberSuggestions.length ===
                          0 && (
                          <div className="member-suggestion">
                            <span className="member-suggestion-info">
                              <strong>
                                No matching member
                              </strong>

                              <small>
                                Try another name
                              </small>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    className="clear-filter-button"
                    disabled={!memberFilter}
                    onClick={
                      clearMemberFilter
                    }
                  >
                    Clear Filter
                  </button>
                </div>

                {memberFilter && (
                  <div className="active-member-chip">
                    <span className="member-avatar">
                      {getInitials(
                        selectedMemberName
                      )}
                    </span>

                    <span>
                      Showing points added by{" "}
                      <strong>
                        {selectedMemberName}
                      </strong>
                      . Information:{" "}
                      {
                        filteredInformationPoints.length
                      }
                      , Action:{" "}
                      {
                        filteredActionPoints.length
                      }
                    </span>
                  </div>
                )}
              </section>

              <div className="meeting-tabs">
                <button
                  className={`meeting-tab ${
                    activeTab ===
                    "information"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    changeTab(
                      "information"
                    )
                  }
                >
                  INFORMATION (
                  {
                    filteredInformationPoints.length
                  }
                  )
                </button>

                <button
                  className={`meeting-tab ${
                    activeTab === "action"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    changeTab("action")
                  }
                >
                  ACTION (
                  {
                    filteredActionPoints.length
                  }
                  )
                </button>
              </div>

              <div className="points-list">
                {displayedPoints.length ===
                0 ? (
                  <div className="empty-points">
                    <h3>
                      No {activeTab} points
                      found
                    </h3>

                    <p>
                      {memberFilter
                        ? `No ${activeTab} points were added by ${selectedMemberName}.`
                        : "Click Add Point to add the first meeting point."}
                    </p>
                  </div>
                ) : (
                  displayedPoints.map(
                    (
                      meetingPoint,
                      index
                    ) => (
                      <article
                        className={`point-card ${
                          meetingPoint.pinned
                            ? "pinned"
                            : ""
                        }`}
                        key={meetingPoint.id}
                      >
                        <div className="point-number">
                          {index + 1}
                        </div>

                        <div className="point-content">
                          {meetingPoint.pinned && (
                            <div className="pinned-label">
                              📌 PINNED TO TOP
                            </div>
                          )}

                          {editingPointId ===
                          meetingPoint.id ? (
                            <div>
                              <textarea
                                className="edit-textarea"
                                rows={4}
                                value={
                                  editPointText
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditPointText(
                                    event.target
                                      .value
                                  )
                                }
                              />

                              <div className="edit-actions">
                                <button
                                  className="save-button"
                                  onClick={() =>
                                    saveEditedPoint(
                                      meetingPoint.id
                                    )
                                  }
                                >
                                  Save changes
                                </button>

                                <button
                                  className="cancel-button"
                                  onClick={
                                    cancelEditingPoint
                                  }
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p
                              className={`point-text ${
                                meetingPoint.status ===
                                "Completed"
                                  ? "completed"
                                  : ""
                              }`}
                            >
                              {
                                meetingPoint.text
                              }
                            </p>
                          )}

                          <div className="point-details">
                            <span>
                              Added by{" "}
                              <strong>
                                {
                                  meetingPoint.addedBy
                                }
                              </strong>
                            </span>

                            <span>
                              {
                                meetingPoint.addedAt
                              }
                            </span>

                            {activeTab ===
                              "action" &&
                              meetingPoint.status && (
                                <button
                                  className={`status-button ${
                                    meetingPoint.status ===
                                    "Completed"
                                      ? "completed"
                                      : "open"
                                  }`}
                                  disabled={!canModify}
                                  onClick={() =>
                                    changeActionStatus(
                                      meetingPoint.id
                                    )
                                  }
                                >
                                  {
                                    meetingPoint.status
                                  }
                                </button>
                              )}
                          </div>
                        </div>

                        {canModify && (
                        <div className="menu-wrapper">
                          <button
                            className={`three-dot-button ${
                              openPointMenuId ===
                              meetingPoint.id
                                ? "open"
                                : ""
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();

                              togglePointMenu(
                                meetingPoint.id
                              );
                            }}
                          >
                            ⋮
                          </button>

                          {openPointMenuId ===
                            meetingPoint.id && (
                            <div
                              className="options-menu"
                              onClick={(event) =>
                                event.stopPropagation()
                              }
                            >
                              <button
                                className="menu-option"
                                onClick={() =>
                                  startEditingPoint(
                                    meetingPoint.id,
                                    meetingPoint.text
                                  )
                                }
                              >
                                <span className="menu-icon">
                                  ✎
                                </span>
                                <span>
                                  Edit point
                                </span>
                              </button>

                              <button
                                className="menu-option"
                                onClick={() =>
                                  togglePinPoint(
                                    meetingPoint.id
                                  )
                                }
                              >
                                <span className="menu-icon">
                                  📌
                                </span>
                                <span>
                                  {meetingPoint.pinned
                                    ? "Unpin point"
                                    : "Pin to top"}
                                </span>
                              </button>

                              <div className="menu-separator" />

                              {canDelete && (
                                <button
                                  className="menu-option delete"
                                  onClick={() =>
                                    deletePoint(
                                      meetingPoint.id
                                    )
                                  }
                                >
                                  <span className="menu-icon">
                                    🗑
                                  </span>
                                  <span>
                                    Delete point
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        )}
                      </article>
                    )
                  )
                )}
              </div>
            </main>
          </section>
        </div>

        {showNewMeetingModal && (
          <div
            className="modal-background"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeNewMeetingModal();
              }
            }}
          >
            <div className="modal-box">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">
                    NEW MEETING
                  </p>
                  <h2>
                    Create New TBM
                  </h2>
                </div>

                <button
                  className="close-button"
                  onClick={
                    closeNewMeetingModal
                  }
                >
                  ×
                </button>
              </div>

              <label className="form-label">
                TBM Name or Meeting
                Title
              </label>

              <input
                className="form-field"
                type="text"
                placeholder="Optional meeting title"
                value={newMeetingName}
                onChange={(event) =>
                  setNewMeetingName(
                    event.target.value
                  )
                }
              />

              <p className="form-help">
                Leave the name empty to
                use the next automatic
                serial name.
              </p>

              <label className="form-label">
                Meeting Date
              </label>

              <input
                className="form-field"
                type="date"
                value={newMeetingDate}
                onChange={(event) =>
                  setNewMeetingDate(
                    event.target.value
                  )
                }
              />

              <button
                className="primary-button modal-submit"
                onClick={
                  createNewMeeting
                }
              >
                Create TBM
              </button>
            </div>
          </div>
        )}

        {showEditMeetingModal && (
          <div
            className="modal-background"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeEditMeetingModal();
              }
            }}
          >
            <div className="modal-box">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">
                    EDIT MEETING
                  </p>
                  <h2>
                    Edit TBM Details
                  </h2>
                </div>

                <button
                  className="close-button"
                  onClick={
                    closeEditMeetingModal
                  }
                >
                  ×
                </button>
              </div>

              <label className="form-label">
                TBM Name or Meeting
                Title
              </label>

              <input
                className="form-field"
                type="text"
                value={editMeetingName}
                onChange={(event) =>
                  setEditMeetingName(
                    event.target.value
                  )
                }
              />

              <label className="form-label">
                Meeting Date
              </label>

              <input
                className="form-field"
                type="date"
                value={editMeetingDate}
                onChange={(event) =>
                  setEditMeetingDate(
                    event.target.value
                  )
                }
              />

              <button
                className="primary-button modal-submit"
                onClick={
                  saveEditedMeeting
                }
              >
                Save Meeting Changes
              </button>
            </div>
          </div>
        )}

        {showPointModal && (
          <div
            className="modal-background"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closePointModal();
              }
            }}
          >
            <div className="modal-box">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">
                    {selectedMeeting.name}
                  </p>

                  <h2>
                    Add{" "}
                    {activeTab ===
                    "information"
                      ? "Information"
                      : "Action"}{" "}
                    Point
                  </h2>
                </div>

                <button
                  className="close-button"
                  onClick={closePointModal}
                >
                  ×
                </button>
              </div>

              <label className="form-label">
                Member Name
              </label>

              <input
                className="form-field"
                type="text"
                placeholder="Enter your name"
                value={memberName}
                onChange={(event) =>
                  setMemberName(
                    event.target.value
                  )
                }
              />

              <label className="form-label">
                Point Details
              </label>

              <textarea
                className="form-field"
                rows={5}
                placeholder="What was discussed in the meeting?"
                value={pointText}
                onChange={(event) =>
                  setPointText(
                    event.target.value
                  )
                }
              />

              <button
                className="primary-button modal-submit"
                onClick={addNewPoint}
              >
                Publish Point
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}