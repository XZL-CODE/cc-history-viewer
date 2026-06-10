// 设置弹窗：配置 Claude 数据目录（数据源）。受控组件，无 portal。

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useSettings } from "@/hooks/queries";
import { api, errMessage } from "@/lib/api";
import { useT } from "@/i18n";
import type { SettingsInput } from "@/lib/types";
import { Badge, Button, Input, Spinner } from "@/components/ui";

const EMPTY_FORM: SettingsInput = {
  claudeDataDir: "",
  historyFile: "",
  projectsDir: "",
  sessionsDir: "",
};

function ResolvedRow({
  label,
  path,
  exists,
}: {
  label: string;
  path: string;
  exists: boolean;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted">{label}</span>
      <span
        className="min-w-0 flex-1 truncate text-foreground"
        title={path}
      >
        {path}
      </span>
      <Badge tone={exists ? "success" : "warning"}>
        {exists ? t("exists") : t("notExists")}
      </Badge>
    </div>
  );
}

function FormField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        spellCheck={false}
      />
    </label>
  );
}

export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const t = useT();
  const settingsQ = useSettings(open);
  const data = settingsQ.data;

  const [form, setForm] = useState<SettingsInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  // 加载/保存成功后，把表单同步为后端当前值
  useEffect(() => {
    if (data) {
      setForm({
        claudeDataDir: data.claudeDataDir,
        historyFile: data.historyFile,
        projectsDir: data.projectsDir,
        sessionsDir: data.sessionsDir,
      });
    }
  }, [data]);

  // 每次打开时清掉上次的提示
  useEffect(() => {
    if (open) {
      setSaveError(null);
      setSavedMsg(false);
    }
  }, [open]);

  const dirty = useMemo(() => {
    if (!data) return false;
    return (
      form.claudeDataDir !== data.claudeDataDir ||
      form.historyFile !== data.historyFile ||
      form.projectsDir !== data.projectsDir ||
      form.sessionsDir !== data.sessionsDir
    );
  }, [form, data]);

  if (!open) return null;

  const setField =
    (key: keyof SettingsInput) => (e: ChangeEvent<HTMLInputElement>) => {
      setSavedMsg(false);
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    setSavedMsg(false);
    try {
      const next = await api.setSettings(form);
      // 先用返回值刷新 resolved 显示，再全量失效让索引按新数据源懒重建
      queryClient.setQueryData(["settings"], next);
      await queryClient.invalidateQueries();
      setSavedMsg(true);
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />

      {/* 卡片 */}
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">
            {t("settingsTitle")}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title={t("close")}
          >
            <X size={16} />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {settingsQ.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted">
              <Spinner /> {t("loadingSettings")}
            </div>
          ) : settingsQ.isError ? (
            <p className="py-6 text-center text-xs text-danger">
              {t("loadSettingsFailed", {
                error: errMessage(settingsQ.error),
              })}
            </p>
          ) : (
            <>
              <FormField
                label={t("claudeDataDirLabel")}
                value={form.claudeDataDir}
                placeholder={t("claudeDataDirPlaceholder")}
                onChange={setField("claudeDataDir")}
              />

              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted">
                  {t("advancedOverrides")}
                </summary>
                <div className="space-y-3 px-3 pb-3 pt-1">
                  <FormField
                    label={t("historyFileLabel")}
                    value={form.historyFile}
                    placeholder={t("overridePlaceholder")}
                    onChange={setField("historyFile")}
                  />
                  <FormField
                    label={t("projectsDirLabel")}
                    value={form.projectsDir}
                    placeholder={t("overridePlaceholder")}
                    onChange={setField("projectsDir")}
                  />
                  <FormField
                    label={t("sessionsDirLabel")}
                    value={form.sessionsDir}
                    placeholder={t("overridePlaceholder")}
                    onChange={setField("sessionsDir")}
                  />
                </div>
              </details>

              {data && (
                <div className="space-y-2 rounded-lg bg-surface-2/60 p-3">
                  <div className="text-xs font-medium text-foreground">
                    {t("resolvedPaths")}
                  </div>
                  <ResolvedRow
                    label={t("historyFileShort")}
                    path={data.resolved.history}
                    exists={data.resolved.historyExists}
                  />
                  <ResolvedRow
                    label={t("projectsDirShort")}
                    path={data.resolved.projects}
                    exists={data.resolved.projectsExists}
                  />
                  <ResolvedRow
                    label={t("sessionsDirShort")}
                    path={data.resolved.sessions}
                    exists={data.resolved.sessionsExists}
                  />
                </div>
              )}

              {saveError && (
                <p className="text-xs text-danger">
                  {t("saveFailed", { error: saveError })}
                </p>
              )}
              {savedMsg && (
                <p className="text-xs text-success">{t("savedMessage")}</p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
          <span
            className="min-w-0 flex-1 truncate text-[11px] text-muted"
            title={data?.configPath}
          >
            {data ? t("configFileLabel", { path: data.configPath }) : ""}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("close")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving || !data}
            >
              {saving && (
                <Spinner className="border-accent-fg/40 border-t-accent-fg" />
              )}
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
