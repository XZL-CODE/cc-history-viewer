mod commands;
mod indexer;
mod models;
mod parser;
mod state;

use state::AppState;

/// Tauri 应用入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_projects,
            commands::get_project_prompts,
            commands::get_recent_prompts,
            commands::search_prompts,
            commands::get_stats,
            commands::get_project_sessions,
            commands::get_conversation,
            commands::get_index_meta,
            commands::refresh_index,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}
