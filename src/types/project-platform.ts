/** Hand-maintained SQL shapes for migration 0013. Shapes are not grants: use RPCs for guarded writes.
 * PostgreSQL numeric/bigint use number in Supabase JSON; the engine accepts decimal strings separately.
 */
export type Json = string | number | boolean | null | Json[] | {
    [key: string]: Json | undefined;
};
export type ProjectRole = 'owner' | 'developer' | 'viewer';
export type ProjectMemberRole = ProjectRole;
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export interface Standard {
    id: string;
    code: string;
    name: string;
    created_at: string;
}
export interface Methodology {
    id: string;
    standard_id: string;
    code: string;
    version: string;
    name: string;
    project_type: string;
    status: 'draft' | 'published';
    is_sample: boolean;
    professionally_validated: boolean;
    disclaimer: string;
    metric_schema: Json;
    schema_hash: string;
    published_at: string | null;
    created_at: string;
}
export interface MethodologyFactor {
    id: string;
    methodology_id: string;
    key: string;
    value: number;
    unit: string;
    scope: Json;
    source: string;
}
export interface ReportTemplate {
    id: string;
    standard_id: string;
    methodology_id: string;
    version: string;
    format: 'pdf' | 'docx';
    status: 'placeholder' | 'ready';
    bucket_id: 'methodology-templates';
    object_path: string | null;
    checksum: string | null;
    mapping: Json;
    disclaimer: string;
    created_at: string;
}
export interface Project {
    id: string;
    name: string;
    description: string;
    created_by: string;
    standard_id: string | null;
    methodology_id: string | null;
    standard_locked_at: string | null;
    methodology_locked_at: string | null;
    baseline: Json;
    baseline_revision: number;
    membership_revision: number;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
}
export interface ProjectMember {
    project_id: string;
    user_id: string;
    role: ProjectRole;
    joined_at: string;
}
export interface ProjectStage {
    id: string;
    project_id: string;
    ordinal: number;
    title: string;
    approved_at: string | null;
    approved_by: string | null;
}
export interface ProjectTask {
    id: string;
    project_id: string;
    stage_id: string;
    title: string;
    description: string;
    status: TaskStatus;
    assignee_id: string | null;
    assignee_role: 'developer';
    due_at: string | null;
    position: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}
export interface ProjectFile {
    id: string;
    project_id: string;
    uploaded_by: string;
    bucket_id: 'project-documents';
    object_path: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    checksum: string;
    created_at: string;
}
export interface TaskComment {
    id: string;
    project_id: string;
    task_id: string;
    author_id: string;
    body: string;
    created_at: string;
}
export interface TaskAttachment {
    id: string;
    project_id: string;
    task_id: string;
    file_id: string;
    created_at: string;
}
export interface ProjectDocument {
    id: string;
    project_id: string;
    stage_id: string;
    file_id: string;
    kind: 'feasibility' | 'baseline' | 'additionality' | 'pdd' | 'other';
    version: number;
    created_at: string;
}
export interface MonitoringPeriod {
    id: string;
    project_id: string;
    methodology_id: string;
    standard_id: string;
    name: string;
    start_date: string;
    end_date: string;
    version: number;
    status: 'open' | 'locked';
    schema_snapshot: Json;
    schema_hash: string;
    baseline_snapshot: Json;
    baseline_revision: number;
    factors_snapshot: Json;
    data_revision: number;
    data_snapshot: Json | null;
    locked_at: string | null;
    created_by: string;
    created_at: string;
}
export interface MonitoringImport {
    id: string;
    project_id: string;
    period_id: string;
    file_id: string;
    mapping: Json;
    mapping_hash: string;
    schema_hash: string;
    imported_by: string;
    created_at: string;
}
export interface MonitoringData {
    id: string;
    project_id: string;
    period_id: string;
    record_key: string;
    observed_on: string;
    metric_values: Json;
    raw_input: Json;
    import_id: string | null;
    source_row: number | null;
    entered_by: string;
    revision: number;
    updated_at: string;
}
export interface MrvReport {
    id: string;
    project_id: string;
    period_id: string;
    methodology_id: string;
    standard_id: string;
    template_id: string;
    version: number;
    status: 'preview' | 'final';
    schema_hash: string;
    schema_snapshot: Json;
    baseline_snapshot: Json;
    baseline_revision: number;
    factors_snapshot: Json;
    data_revision: number;
    input_snapshot: Json;
    template_snapshot: Json;
    results: Json;
    calculation_trace: Json;
    engine_version: string;
    output_file_id: string | null;
    requested_by: string;
    generated_at: string;
}
export type MRVReport = MrvReport;
type Table<R, Required extends keyof R, Generated extends keyof R = never> = {
    Row: R;
    Insert: Pick<R, Required> & Partial<Omit<R, Required | Generated>> & {
        [K in Generated]?: never;
    };
    Update: Partial<Omit<R, Generated>> & {
        [K in Generated]?: never;
    };
};
export interface ProjectPlatformTables {
    standards: Table<Standard, 'code' | 'name'>;
    methodologies: Table<Methodology, 'standard_id' | 'code' | 'version' | 'name' | 'project_type' | 'disclaimer' | 'metric_schema', 'schema_hash'>;
    methodology_factors: Table<MethodologyFactor, 'methodology_id' | 'key' | 'value' | 'unit' | 'source'>;
    report_templates: Table<ReportTemplate, 'standard_id' | 'methodology_id' | 'version' | 'format' | 'disclaimer'>;
    projects: Table<Project, 'name' | 'created_by'>;
    project_members: Table<ProjectMember, 'project_id' | 'user_id' | 'role'>;
    project_stages: Table<ProjectStage, 'project_id' | 'ordinal' | 'title'>;
    project_tasks: Table<ProjectTask, 'project_id' | 'stage_id' | 'title'>;
    project_files: Table<ProjectFile, 'project_id' | 'object_path' | 'original_name' | 'mime_type' | 'size_bytes' | 'checksum'>;
    task_comments: Table<TaskComment, 'project_id' | 'task_id' | 'body'>;
    task_attachments: Table<TaskAttachment, 'project_id' | 'task_id' | 'file_id'>;
    project_documents: Table<ProjectDocument, 'project_id' | 'stage_id' | 'file_id' | 'kind' | 'version'>;
    monitoring_periods: Table<MonitoringPeriod, 'project_id' | 'methodology_id' | 'standard_id' | 'name' | 'start_date' | 'end_date' | 'schema_snapshot' | 'schema_hash' | 'baseline_snapshot' | 'baseline_revision' | 'factors_snapshot' | 'created_by'>;
    monitoring_imports: Table<MonitoringImport, 'project_id' | 'period_id' | 'file_id' | 'mapping' | 'schema_hash' | 'imported_by', 'mapping_hash'>;
    monitoring_data: Table<MonitoringData, 'project_id' | 'period_id' | 'record_key' | 'observed_on' | 'metric_values' | 'entered_by' | 'revision'>;
    mrv_reports: Table<MrvReport, 'project_id' | 'period_id' | 'methodology_id' | 'standard_id' | 'template_id' | 'version' | 'status' | 'schema_hash' | 'schema_snapshot' | 'baseline_snapshot' | 'baseline_revision' | 'factors_snapshot' | 'data_revision' | 'input_snapshot' | 'template_snapshot' | 'results' | 'calculation_trace' | 'engine_version' | 'requested_by'>;
}
export type Row<T extends keyof ProjectPlatformTables> = ProjectPlatformTables[T]['Row'];
export type Insert<T extends keyof ProjectPlatformTables> = ProjectPlatformTables[T]['Insert'];
export type Update<T extends keyof ProjectPlatformTables> = ProjectPlatformTables[T]['Update'];
