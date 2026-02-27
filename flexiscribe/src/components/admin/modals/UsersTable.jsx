"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2 } from "lucide-react";
import EditUserModal from "./EditUserModal";
import MessageModal from "@/components/shared/MessageModal";

/* STATUS BADGE STYLES */
const STATUS_STYLE = {
  Active: "bg-green-100 text-green-700 border border-green-300",
  Inactive: "bg-gray-100 text-gray-600 border border-gray-300",
  Banned: "bg-red-100 text-red-600 border border-red-300",
};

/* GRID LAYOUT */
const GRID =
  "grid-cols-[2fr_1fr_1.3fr_1fr] sm:grid-cols-[3fr_1.5fr_2.5fr_1.5fr_2fr_1fr]";

export default function UsersTable({ roleFilter, statusFilter, dateFilter }) {
  const [editUser, setEditUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter, dateFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (roleFilter && roleFilter !== "All") params.append("role", roleFilter);
      if (statusFilter && statusFilter !== "All")
        params.append("status", statusFilter);
      if (dateFilter && dateFilter !== "All") params.append("date", dateFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId, userName) => {
    setDeleteTarget({ userId, userName });
    setModalInfo({ isOpen: true, title: "Confirm Delete", message: `Are you sure you want to delete ${userName}?`, type: "error" });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setModalInfo({ ...modalInfo, isOpen: false });
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteTarget(null);
        setModalInfo({ isOpen: true, title: "Success", message: "User deleted successfully.", type: "success" });
        fetchUsers();
      } else {
        const error = await res.json();
        setDeleteTarget(null);
        setModalInfo({ isOpen: true, title: "Error", message: error.error || "Failed to delete user.", type: "error" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      setDeleteTarget(null);
      setModalInfo({ isOpen: true, title: "Error", message: "An error occurred while deleting user.", type: "error" });
    }
  };

  function formatDate(date) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-[0_24px_60px_rgba(76,65,114,0.18)] p-10 text-center">
        <p className="text-[#9d8adb]">Loading users...</p>
      </div>
    );
  }

  return (
    <>
      {/* ================= DESKTOP TABLE ================= */}
      <div className="hidden sm:block bg-white rounded-3xl shadow-[0_24px_60px_rgba(76,65,114,0.18)] overflow-hidden">
        {/* HEADER */}
        <div
          className={`grid ${GRID} bg-[#9d8adb] px-5 py-4 text-white text-sm font-semibold items-center`}
        >
          <span>Full Name</span>
          <span>Username</span>
          <span className="text-center">Status</span>
          <span className="text-center">Role</span>
          <span>Joined</span>
          <span className="text-center">Actions</span>
        </div>

        {/* ROWS */}
        <div className="divide-y divide-[#eeeaf8]">
          {users.length === 0 ? (
            <div className="px-5 py-10 text-center text-[#9d8adb]">
              No users found
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className={`grid ${GRID} px-5 py-4 items-center hover:bg-[#f7f5fc] transition`}
              >
                {/* NAME */}
                <div>
                  <p className="font-semibold text-[#4c4172]">
                    {u.fullName || u.name}
                  </p>
                  <p className="text-sm text-[#7b6fae]">{u.email}</p>
                  {u.phoneNumber && (
                    <p className="text-xs text-[#9d8adb]">{u.phoneNumber}</p>
                  )}
                </div>

                {/* USERNAME */}
                <div className="text-[#6f63a6]">@{u.username}</div>

                {/* STATUS */}
                <div className="flex justify-center">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      STATUS_STYLE[u.status]
                    }`}
                  >
                    {u.status}
                  </span>
                </div>

                {/* ROLE */}
                <div className="text-[#6f63a6] text-center">{u.role}</div>

                {/* JOINED */}
                <div className="text-[#9a94b8]">
                  {formatDate(u.createdAt || u.joined)}
                </div>

                {/* ACTIONS */}
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setEditUser(u)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-[#6f63a6] hover:bg-[#ede9fe]"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => handleDelete(u.id, u.fullName || u.name)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-red-500 hover:bg-[#fdecec]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ================= MOBILE CARDS ================= */}
      <div className="sm:hidden space-y-4">
        {users.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-[#9d8adb]">
            No users found
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="bg-white rounded-2xl p-4 shadow">
              {/* HEADER */}
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-[#4c4172]">
                    {u.fullName || u.name}
                  </p>
                  <p className="text-sm text-[#7b6fae]">{u.email}</p>
                  {u.phoneNumber && (
                    <p className="text-xs text-[#9d8adb]">{u.phoneNumber}</p>
                  )}
                </div>

                <span
                  className={`px-5 py-3 rounded-full text-xs font-semibold whitespace-nowrap border ${
                    STATUS_STYLE[u.status]
                  }`}
                >
                  {u.status}
                </span>
              </div>

              {/* DETAILS */}
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Username</p>
                  <p className="font-medium text-[#4c4172]">@{u.username}</p>
                </div>

                <div>
                  <p className="text-gray-400 text-xs">Role</p>
                  <p className="font-medium text-[#4c4172]">{u.role}</p>
                </div>

                <div>
                  <p className="text-gray-400 text-xs">Joined</p>
                  <p className="font-medium text-[#4c4172]">
                    {formatDate(u.createdAt || u.joined)}
                  </p>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={() => setEditUser(u)}
                  className="px-4 py-2 text-sm rounded-full border text-[#6f63a6]"
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(u.id, u.fullName || u.name)}
                  className="px-4 py-2 text-sm rounded-full bg-red-100 text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* EDIT MODAL */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => {
            setEditUser(null);
            fetchUsers(); // Refresh after edit
          }}
        />
      )}

      <MessageModal
        isOpen={modalInfo.isOpen}
        onClose={() => {
          setModalInfo({ ...modalInfo, isOpen: false });
          setDeleteTarget(null);
        }}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
        onConfirm={deleteTarget ? executeDelete : undefined}
      />
    </>
  );
}
