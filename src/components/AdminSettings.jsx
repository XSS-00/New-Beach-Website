import { useState, useEffect } from "react";

const PASSWORD_KEY = "nbo_admin_password";

function Field({ label, value, onChange, show, toggleShow, errorKey, errors, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full px-4 py-3 rounded-xl border text-slate-800 text-sm outline-none transition
            focus:ring-2 focus:ring-teal-400
            ${errors[errorKey] ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"}`}
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-500 text-xs"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hint && !errors[errorKey] && (
        <p className="text-xs text-slate-400">{hint}</p>
      )}
      {errors[errorKey] && (
        <p className="text-xs text-red-500 font-medium">{errors[errorKey]}</p>
      )}
    </div>
  );
}

export default function AdminSettings({ t }) {
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!localStorage.getItem(PASSWORD_KEY)) {
      localStorage.setItem(PASSWORD_KEY, "newbeach2025");
    }
  }, []);

  const validate = () => {
    const stored = localStorage.getItem(PASSWORD_KEY) || "newbeach2025";
    const newErrors = {};

    if (!current) {
      newErrors.current = "Current password is required";
    } else if (current !== stored) {
      newErrors.current = "Incorrect current password";
    }

    if (!newPass) {
      newErrors.newPass = "New password is required";
    } else if (newPass.length < 8 || !/\d/.test(newPass)) {
      newErrors.newPass = "Min. 8 characters including at least one number";
    }

    if (!confirm) {
      newErrors.confirm = "Please confirm your new password";
    } else if (confirm !== newPass) {
      newErrors.confirm = "Passwords do not match";
    }

    return newErrors;
  };

  const handleSubmit = () => {
    const found = validate();
    setErrors(found);
    setSuccessMsg("");
    if (Object.keys(found).length > 0) return;

    localStorage.setItem(PASSWORD_KEY, newPass);
    setCurrent("");
    setNewPass("");
    setConfirm("");
    setErrors({});
    setSuccessMsg("✅ Password updated successfully. Use your new password on next login.");
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  const isEmpty = !current && !newPass && !confirm;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Settings</h2>
      <p className="text-slate-500 text-sm mb-8">Manage your admin account preferences.</p>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🔐</span>
          <h3 className="text-lg font-semibold text-slate-800">Change Password</h3>
        </div>

        <Field
          label="Current Password"
          value={current}
          onChange={setCurrent}
          show={showCurrent}
          toggleShow={() => setShowCurrent(p => !p)}
          errorKey="current"
          errors={errors}
        />

        <Field
          label="New Password"
          value={newPass}
          onChange={setNewPass}
          show={showNew}
          toggleShow={() => setShowNew(p => !p)}
          errorKey="newPass"
          errors={errors}
          hint="Min. 8 characters, including at least one number"
        />

        <Field
          label="Confirm New Password"
          value={confirm}
          onChange={setConfirm}
          show={showConfirm}
          toggleShow={() => setShowConfirm(p => !p)}
          errorKey="confirm"
          errors={errors}
        />

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 font-medium">
            {successMsg}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isEmpty}
          className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm transition"
        >
          Update Password
        </button>
      </div>
    </div>
  );
}