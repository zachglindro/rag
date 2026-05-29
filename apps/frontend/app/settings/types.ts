export interface ModelInfo {
  id: string
  label: string
  path: string
  source: "local" | "online"
  loaded: boolean
  downloaded: boolean
}

export interface ModelSettingsResponse {
  active_model: string
  available_models: ModelInfo[]
}

export interface BackupSettings {
  enabled: boolean
  subfolder: string
  frequency: string
  retention: number
  format: string
  base_path: string
  last_backup_time: number | null
}
