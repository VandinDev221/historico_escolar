const API_BASE = '/api';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN_ESCOLAR' | 'PROFESSOR' | 'PAIS_RESPONSAVEL';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId: string | null;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Falha no login');
  }
  return res.json();
}

export async function fetchWithAuth<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message || 'Erro na requisição');
    throw new Error(msg);
  }
  return res.json();
}

export interface SearchSchoolResult {
  id: string;
  name: string;
  code: string | null;
  municipality: { name: string; state: string };
}

export interface SearchStudentResult {
  id: string;
  name: string;
  schoolId: string;
  school: { name: string };
}

export interface GlobalSearchResult {
  schools: SearchSchoolResult[];
  students: SearchStudentResult[];
}

export async function searchGlobal(q: string): Promise<GlobalSearchResult> {
  const params = new URLSearchParams({ q: q.trim() });
  return fetchWithAuth<GlobalSearchResult>(`/search?${params}`);
}

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId: string | null;
  active: boolean;
  createdAt: string;
  school?: { id: string; name: string } | null;
  teacherDisciplines?: { code?: string; gradeConfigId: string; gradeConfig: { id: string; subject: string; series: string } }[];
}

export async function fetchUsers(): Promise<UserListItem[]> {
  return fetchWithAuth<UserListItem[]>('/users');
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  schoolId?: string | null;
  gradeConfigIds?: string[];
}

export async function createUser(payload: CreateUserPayload): Promise<UserListItem> {
  return fetchWithAuth<UserListItem>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  schoolId?: string | null;
  active?: boolean;
  gradeConfigIds?: string[];
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserListItem> {
  return fetchWithAuth<UserListItem>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id: string): Promise<{ message: string }> {
  return fetchWithAuth<{ message: string }>(`/users/${id}`, { method: 'DELETE' });
}

// --- Meu perfil (dados + senha + disciplinas do professor) ---

export interface TeacherDisciplineItem {
  id: string;
  code: string;
  gradeConfigId: string;
  gradeConfig: { id: string; subject: string; series: string };
}

export interface MeProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId: string | null;
  active: boolean;
  createdAt: string;
  school?: { id: string; name: string } | null;
  teacherDisciplines?: TeacherDisciplineItem[];
}

export async function fetchMe(): Promise<MeProfile> {
  return fetchWithAuth<MeProfile>('/users/me');
}

export interface UpdateProfilePayload {
  name?: string;
  password?: string;
  currentPassword?: string;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<MeProfile> {
  return fetchWithAuth<MeProfile>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function addMyDiscipline(gradeConfigId: string): Promise<TeacherDisciplineItem> {
  return fetchWithAuth<TeacherDisciplineItem>('/users/me/disciplines', {
    method: 'POST',
    body: JSON.stringify({ gradeConfigId }),
  });
}

export async function removeMyDiscipline(gradeConfigId: string): Promise<{ message: string }> {
  return fetchWithAuth<{ message: string }>(`/users/me/disciplines/${gradeConfigId}`, {
    method: 'DELETE',
  });
}

export interface GradeConfig {
  id: string;
  subject: string;
  series: string;
  workload: number;
}

export interface Grade {
  id: string;
  enrollmentId: string;
  gradeConfigId: string;
  bimester: number;
  score: number | null;
  frequency: number | null;
  recoveryScore: number | null;
  observations: string | null;
  gradeConfig: GradeConfig;
}

export async function fetchGradeConfigs(
  schoolId: string,
  series: string
): Promise<GradeConfig[]> {
  const params = new URLSearchParams({ series });
  return fetchWithAuth<GradeConfig[]>(`/schools/${schoolId}/grade-configs?${params}`);
}

/** Lista todas as disciplinas (GradeConfig) da escola — para o admin atribuir ao professor */
export async function fetchGradeConfigsBySchool(schoolId: string): Promise<GradeConfig[]> {
  return fetchWithAuth<GradeConfig[]>(`/schools/${schoolId}/grade-configs`);
}

export interface CreateGradeConfigPayload {
  series: string;
  subject: string;
  workload: number;
}

export interface UpdateGradeConfigPayload {
  series?: string;
  subject?: string;
  workload?: number;
}

export async function createGradeConfig(
  schoolId: string,
  payload: CreateGradeConfigPayload
): Promise<GradeConfig> {
  return fetchWithAuth<GradeConfig>(`/schools/${schoolId}/grade-configs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateGradeConfig(
  schoolId: string,
  id: string,
  payload: UpdateGradeConfigPayload
): Promise<GradeConfig> {
  return fetchWithAuth<GradeConfig>(`/schools/${schoolId}/grade-configs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteGradeConfig(
  schoolId: string,
  id: string
): Promise<{ message: string }> {
  return fetchWithAuth<{ message: string }>(`/schools/${schoolId}/grade-configs/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchGrades(enrollmentId: string): Promise<Grade[]> {
  return fetchWithAuth<Grade[]>(`/enrollments/${enrollmentId}/grades`);
}

export interface UpsertGradePayload {
  bimester: number;
  score?: number;
  frequency?: number;
  recoveryScore?: number;
  observations?: string;
}

export async function upsertGrade(
  enrollmentId: string,
  gradeConfigId: string,
  payload: UpsertGradePayload
): Promise<Grade> {
  return fetchWithAuth<Grade>(
    `/enrollments/${enrollmentId}/grades/${gradeConfigId}`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

// --- Lançamento de notas em lote por turma ---
export interface GradeBulkItem {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  score: number | null;
  score1: number | null;
  score2: number | null;
  score3: number | null;
  score4: number | null;
  frequency: number | null;
  totalPresencas: number;
  totalFaltas: number;
  faltasJustificadas: number;
}

export async function getGradesBulkByTurma(
  schoolId: string,
  turmaId: string,
  gradeConfigId: string,
  bimester: number
): Promise<GradeBulkItem[]> {
  return fetchWithAuth<GradeBulkItem[]>(
    `/schools/${schoolId}/turmas/${turmaId}/grades-bulk?gradeConfigId=${encodeURIComponent(gradeConfigId)}&bimester=${bimester}`
  );
}

export async function upsertGradesBulk(
  schoolId: string,
  turmaId: string,
  payload: {
    gradeConfigId: string;
    bimester: number;
    grades: {
      enrollmentId: string;
      score1?: number;
      score2?: number;
      score3?: number;
      score4?: number;
      frequency?: number;
    }[];
  }
): Promise<{ ok: boolean; message: string }> {
  return fetchWithAuth<{ ok: boolean; message: string }>(
    `/schools/${schoolId}/turmas/${turmaId}/grades-bulk`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

// --- Ano letivo (dias letivos / carga horária LDB) ---
export interface YearConfig {
  id?: string;
  schoolId: string;
  year: number;
  daysLetivos: number;
  cargaHorariaAnual: number;
}

export async function getYearConfig(schoolId: string, year: number): Promise<YearConfig> {
  return fetchWithAuth<YearConfig>(`/schools/${schoolId}/year-config/${year}`);
}

export async function upsertYearConfig(
  schoolId: string,
  year: number,
  payload: { daysLetivos?: number; cargaHorariaAnual?: number }
): Promise<YearConfig> {
  return fetchWithAuth<YearConfig>(`/schools/${schoolId}/year-config/${year}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// --- Relatórios: alertas LDB, recuperação, boletim ---
export interface AlertItem {
  id: string;
  student: { id: string; name: string; birthDate: string };
  series: string;
  year: number;
  avgFrequency?: number;
  conselhoTutelarNotifiedAt: string | null;
  conselhoTutelarNotifiedBy?: { id: string; name: string } | null;
}

export interface AlertsResponse {
  lowFrequency: AlertItem[];
  conselhoTutelar: AlertItem[];
}

export async function getAlerts(schoolId: string, year: number): Promise<AlertsResponse> {
  return fetchWithAuth<AlertsResponse>(`/reports/alerts?schoolId=${schoolId}&year=${year}`);
}

export async function notifyConselhoTutelar(enrollmentId: string): Promise<{ conselhoTutelarNotifiedAt: string }> {
  return fetchWithAuth(`/reports/enrollments/${enrollmentId}/notify-conselho-tutelar`, {
    method: 'POST',
  });
}

export interface RecoveryDiscipline {
  subject: string;
  avgScore: number;
  recoveryScore: number | null;
  inRecovery: boolean;
}

export interface RecoveryItem {
  enrollmentId: string;
  student: { id: string; name: string };
  series: string;
  year: number;
  disciplines: RecoveryDiscipline[];
}

export async function getRecovery(schoolId: string, year: number): Promise<{ items: RecoveryItem[] }> {
  return fetchWithAuth<{ items: RecoveryItem[] }>(`/reports/recovery?schoolId=${schoolId}&year=${year}`);
}

export interface BoletimDiscipline {
  subject: string;
  workload: number;
  bimesters: Array<{ bimester: number; score: number | null; frequency: number | null; recoveryScore: number | null }>;
  avgScore: number | null;
  avgFrequency: number | null;
}

export interface BoletimResponse {
  student: { id: string; name: string; birthDate: string };
  school: { id: string; name: string };
  enrollment: { id: string; year: number; series: string; situation: string };
  disciplines: BoletimDiscipline[];
}

export async function getBoletim(enrollmentId: string): Promise<BoletimResponse> {
  return fetchWithAuth<BoletimResponse>(`/reports/boletim/${enrollmentId}`);
}

// --- Relatório diário de classe ---
export interface ClassDiaryStudentRow {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  presencas: number;
  faltas: number;
  faltasJustificadas: number;
  faltasInjustificadas: number;
  frequencyPercent: number | null;
}

export interface ClassDiaryReport {
  turma: { id: string; name: string; series: string; year: number; turno: string | null };
  period: { startDate: string; endDate: string };
  students: ClassDiaryStudentRow[];
}

export async function getClassDiaryReport(
  schoolId: string,
  turmaId: string,
  startDate: string,
  endDate: string
): Promise<ClassDiaryReport> {
  const params = new URLSearchParams({ schoolId, turmaId, startDate, endDate });
  return fetchWithAuth<ClassDiaryReport>(`/reports/diary?${params.toString()}`);
}

// --- Documentos por aluno (também para responsável) ---
export interface DocumentListItem {
  id: string;
  type: string;
  validationCode: string;
  createdAt: string;
  school?: { name: string };
}

export async function fetchDocumentsByStudent(studentId: string): Promise<DocumentListItem[]> {
  return fetchWithAuth<DocumentListItem[]>(`/documents/students/${studentId}`);
}

// --- Histórico Escolar ---
export async function generateHistoricoEscolar(
  schoolId: string,
  studentId: string
): Promise<{ validationCode: string; validateUrl: string; content: string; createdAt: string }> {
  return fetchWithAuth(`/documents/schools/${schoolId}/historico-escolar`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

// --- Turmas e diário de classe ---
export type Turno = 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL';

export interface Turma {
  id: string;
  schoolId: string;
  year: number;
  series: string;
  name: string;
  turno: Turno | null;
  _count?: { enrollments: number };
}

export async function fetchTurmas(schoolId: string, year: number): Promise<Turma[]> {
  return fetchWithAuth<Turma[]>(`/schools/${schoolId}/turmas?year=${year}`);
}

export async function getTurma(schoolId: string, turmaId: string): Promise<Turma> {
  return fetchWithAuth<Turma>(`/schools/${schoolId}/turmas/${turmaId}`);
}

export async function createTurma(
  schoolId: string,
  payload: { year: number; series: string; name: string; turno?: Turno }
): Promise<Turma> {
  return fetchWithAuth<Turma>(`/schools/${schoolId}/turmas`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTurma(
  schoolId: string,
  turmaId: string,
  payload: { series?: string; name?: string; turno?: Turno | null }
): Promise<Turma> {
  return fetchWithAuth<Turma>(`/schools/${schoolId}/turmas/${turmaId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteTurma(schoolId: string, turmaId: string): Promise<void> {
  return fetchWithAuth(`/schools/${schoolId}/turmas/${turmaId}`, { method: 'DELETE' });
}

export interface DiaryItem {
  enrollmentId: string;
  studentName: string;
  studentId: string;
  present: boolean;
  attendanceRecordId: string | null;
  justified: boolean;
  justifiedAt: string | null;
  justifiedNote: string | null;
  atestadoDocRef: string | null;
  atestadoImageUrl: string | null;
  justifiedByName: string | null;
}

export interface DiaryResponse {
  turma: { id: string; name: string; series: string; year: number };
  date: string;
  items: DiaryItem[];
}

export async function getDiary(
  schoolId: string,
  turmaId: string,
  date: string
): Promise<DiaryResponse> {
  return fetchWithAuth<DiaryResponse>(
    `/schools/${schoolId}/turmas/${turmaId}/diary?date=${encodeURIComponent(date)}`
  );
}

export async function upsertDiary(
  schoolId: string,
  turmaId: string,
  payload: { date: string; records: { enrollmentId: string; present: boolean }[] }
): Promise<DiaryResponse> {
  return fetchWithAuth<DiaryResponse>(`/schools/${schoolId}/turmas/${turmaId}/diary`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Justificar falta (atestado etc.) — apenas admin da escola. Opcionalmente envia imagem do atestado. */
export async function justifyAbsence(
  schoolId: string,
  turmaId: string,
  recordId: string,
  body: { note?: string; atestadoDocRef?: string; atestadoImage?: File }
): Promise<{ ok: boolean; message: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  let reqBody: string | FormData;
  if (body.atestadoImage) {
    const formData = new FormData();
    if (body.note?.trim()) formData.append('note', body.note.trim());
    if (body.atestadoDocRef?.trim()) formData.append('atestadoDocRef', body.atestadoDocRef.trim());
    formData.append('atestadoImage', body.atestadoImage);
    reqBody = formData;
    // Não definir Content-Type; o navegador define multipart/form-data com boundary
  } else {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
    reqBody = JSON.stringify({
      ...(body.note?.trim() ? { note: body.note.trim() } : {}),
      ...(body.atestadoDocRef?.trim() ? { atestadoDocRef: body.atestadoDocRef.trim() } : {}),
    });
  }

  const res = await fetch(
    `${API_BASE}/schools/${schoolId}/turmas/${turmaId}/attendance-records/${recordId}/justify`,
    { method: 'PATCH', headers, body: reqBody }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao justificar falta.');
  }
  return res.json();
}

/** Retorna a URL da imagem do atestado (com auth). Use revokeObjectURL quando não precisar mais. */
export async function getAtestadoImageBlobUrl(
  schoolId: string,
  turmaId: string,
  recordId: string
): Promise<string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(
    `${API_BASE}/schools/${schoolId}/turmas/${turmaId}/attendance-records/${recordId}/atestado-image`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!res.ok) throw new Error('Imagem não encontrada.');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// --- Regras de promoção/retenção ---
export interface PromotionRule {
  schoolId: string;
  year: number | null;
  minScore: number;
  minFrequencyPercent: number;
  useRecoveryScore: boolean;
}

export async function getPromotionRule(
  schoolId: string,
  year?: number | null
): Promise<PromotionRule> {
  const q = year != null ? `?year=${year}` : '';
  return fetchWithAuth<PromotionRule>(`/schools/${schoolId}/promotion-rule${q}`);
}

export async function upsertPromotionRule(
  schoolId: string,
  payload: { year?: number | null; minScore?: number; minFrequencyPercent?: number; useRecoveryScore?: boolean }
): Promise<PromotionRule> {
  return fetchWithAuth<PromotionRule>(`/schools/${schoolId}/promotion-rule`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// --- Portal do responsável (meus filhos) ---
export interface GuardianStudent {
  id: string;
  name: string;
  birthDate: string;
  schoolId: string;
  school: { id: string; name: string };
  enrollments: { id: string; year: number; series: string; situation: string }[];
}

export async function getMyGuardianStudents(): Promise<GuardianStudent[]> {
  return fetchWithAuth<GuardianStudent[]>('/users/me/students');
}

export async function addGuardian(
  schoolId: string,
  studentId: string,
  payload: { userId: string; relation?: string; isPrimary?: boolean }
): Promise<unknown> {
  return fetchWithAuth(`/schools/${schoolId}/students/${studentId}/guardians`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeGuardian(
  schoolId: string,
  studentId: string,
  guardianUserId: string
): Promise<{ message: string }> {
  return fetchWithAuth(`/schools/${schoolId}/students/${studentId}/guardians/${guardianUserId}`, {
    method: 'DELETE',
  });
}

export async function fetchStudentGuardians(
  schoolId: string,
  studentId: string
): Promise<{ id: string; user: { id: string; name: string; email: string }; relation: string }[]> {
  return fetchWithAuth(`/schools/${schoolId}/students/${studentId}/guardians`);
}

// --- Matrículas (Enrollment) ---

export interface EnrollmentSummary {
  id: string;
  year: number;
  series: string;
  situation: string;
  turma?: { id: string; name: string } | null;
}

export interface CreateEnrollmentPayload {
  year: number;
  series: string;
  situation?: 'CURSANDO' | 'CONCLUIDO' | 'TRANSFERIDO' | 'EVADIDO';
  /** Na atualização, `null` remove a turma da matrícula (alinhado ao PATCH do backend). */
  turmaId?: string | null;
}

export async function createEnrollment(
  schoolId: string,
  studentId: string,
  payload: CreateEnrollmentPayload
): Promise<EnrollmentSummary> {
  return fetchWithAuth<EnrollmentSummary>(
    `/schools/${schoolId}/students/${studentId}/enrollments`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function updateEnrollment(
  schoolId: string,
  studentId: string,
  enrollmentId: string,
  payload: Partial<CreateEnrollmentPayload>
): Promise<EnrollmentSummary> {
  return fetchWithAuth<EnrollmentSummary>(
    `/schools/${schoolId}/students/${studentId}/enrollments/${enrollmentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}
