const { createApp, ref, reactive, computed, onMounted } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

const LoginView = {
    template: `
        <div class="card auth-card p-4">
            <div class="text-center mb-4">
                <h3 class="fw-bold mt-2 text-purple-deep">Welcome back</h3>
                <p class="text-muted">Sign in to your placement account</p>
            </div>

            <div v-if="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
                {{ errorMessage }}
                <button type="button" class="btn-close" @click="errorMessage = ''"></button>
            </div>

            <form @submit.prevent="handleLogin">
                <div class="mb-3">
                    <label class="form-label font-weight-medium">Email Address</label>
                    <input type="email" v-model="form.email" class="form-control" placeholder="user@institute.com" required>
                </div>

                <div class="mb-4">
                    <label class="form-label font-weight-medium">Password</label>
                    <input type="password" v-model="form.password" class="form-control" placeholder="••••••••" required>
                </div>

                <button type="submit" class="btn btn-purple w-100 py-2.5 rounded-3 fw-semibold" :disabled="loading">
                    <span>{{ loading ? 'Signing In...' : 'Sign In' }}</span>
                </button>
            </form>

            <div class="text-center mt-4 border-top pt-3">
                <p class="text-muted mb-0">Don't have an account? 
                    <router-link to="/register" class="text-purple-vibrant fw-semibold">Register here</router-link>
                </p>
            </div>
        </div>
    `,
    setup() {
        const form = reactive({ email: '', password: '' });
        const errorMessage = ref('');
        const loading = ref(false);
        const router = VueRouter.useRouter();

        const handleLogin = async () => {
            loading.value = true;
            errorMessage.value = '';
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Login failed');
                }

                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                window.dispatchEvent(new Event('auth-changed'));

                if (data.user.role === 'admin') {
                    router.push('/admin');
                } else if (data.user.role === 'company') {
                    router.push('/company');
                } else {
                    router.push('/student');
                }
            } catch (err) {
                errorMessage.value = err.message;
            } finally {
                loading.value = false;
            }
        };

        return { form, errorMessage, loading, handleLogin };
    }
};

const RegisterView = {
    template: `
        <div class="card auth-card p-4">
            <div class="text-center mb-4">
                <h3 class="fw-bold mt-2 text-purple-deep">Create Account</h3>
                <p class="text-muted">Register as a Student or Company</p>
            </div>

            <div v-if="errorMessage" class="alert alert-danger alert-dismissible fade show" role="alert">
                {{ errorMessage }}
                <button type="button" class="btn-close" @click="errorMessage = ''"></button>
            </div>

            <form @submit.prevent="handleRegister">
                <div class="mb-3">
                    <label class="form-label">Full Name / Company Name</label>
                    <input type="text" v-model="form.full_name" class="form-control" placeholder="John Doe or Acme Inc." required>
                </div>

                <div class="mb-3">
                    <label class="form-label">Email Address</label>
                    <input type="email" v-model="form.email" class="form-control" placeholder="user@domain.com" required>
                </div>

                <div class="mb-3">
                    <label class="form-label">Account Role</label>
                    <select v-model="form.role" class="form-select" required>
                        <option value="" disabled>Select your role</option>
                        <option value="student">Student</option>
                        <option value="company">Company</option>
                    </select>
                </div>

                <div class="mb-4">
                    <label class="form-label">Password</label>
                    <input type="password" v-model="form.password" class="form-control" placeholder="••••••••" required>
                </div>

                <button type="submit" class="btn btn-purple w-100 py-2.5 rounded-3 fw-semibold" :disabled="loading">
                    <span>{{ loading ? 'Creating Account...' : 'Register' }}</span>
                </button>
            </form>

            <div class="text-center mt-4 border-top pt-3">
                <p class="text-muted mb-0">Already registered? 
                    <router-link to="/login" class="text-purple-vibrant fw-semibold">Sign in here</router-link>
                </p>
            </div>
        </div>
    `,
    setup() {
        const form = reactive({ full_name: '', email: '', role: 'student', password: '' });
        const errorMessage = ref('');
        const loading = ref(false);
        const router = VueRouter.useRouter();

        const handleRegister = async () => {
            loading.value = true;
            errorMessage.value = '';
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Registration failed');
                }
                alert('Registration successful! Please log in.');
                router.push('/login');
            } catch (err) {
                errorMessage.value = err.message;
            } finally {
                loading.value = false;
            }
        };

        return { form, errorMessage, loading, handleRegister };
    }
};

const AdminDashboardView = {
    template: `
        <div class="py-2">
            <!-- Title Header -->
            <div class="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h2 class="fw-bold mb-1 text-purple-deep">Admin Management Console</h2>
                    <p class="text-muted mb-0">Ascentia Institute Placement Cell Overview</p>
                </div>
                <button @click="loadAdminData" class="btn btn-outline-secondary btn-sm px-3 rounded-pill d-flex align-items-center gap-1">
                    <i class="bi bi-arrow-clockwise"></i> Refresh
                </button>
            </div>

            

            <!-- Toast Alerts -->
            <div v-if="alertMessage" class="alert alert-success alert-dismissible fade show mb-4" role="alert">
                {{ alertMessage }}
                <button type="button" class="btn-close" @click="alertMessage = ''"></button>
            </div>
            <div v-if="errorMessage" class="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                {{ errorMessage }}
                <button type="button" class="btn-close" @click="errorMessage = ''"></button>
            </div>

            <!-- Stats Metric Cards (Grid Aligned) -->
            <div class="row g-3 mb-4">
                <div class="col-6 col-lg-3">
                    <div class="metric-box h-100 d-flex flex-column justify-content-between">
                        <span class="text-muted small text-uppercase fw-semibold">Total Students</span>
                        <div class="d-flex align-items-baseline justify-content-between mt-2">
                            <h3 class="fw-bold text-purple-deep mb-0">{{ stats.students || 0 }}</h3>
                            <span class="badge badge-lavender">{{ stats.opt_in_students || 0 }} Opt-in</span>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="metric-box h-100 d-flex flex-column justify-content-between">
                        <span class="text-muted small text-uppercase fw-semibold">Registered Companies</span>
                        <div class="d-flex align-items-baseline justify-content-between mt-2">
                            <h3 class="fw-bold text-purple-deep mb-0">{{ stats.companies || 0 }}</h3>
                            <span class="badge bg-warning text-dark" v-if="stats.pending_companies_count > 0">
                                <i class="bi bi-hourglass-split me-1"></i>{{ stats.pending_companies_count }} Pending
                            </span>
                            <span class="badge bg-success-subtle text-success" v-else>Approved</span>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="metric-box h-100 d-flex flex-column justify-content-between">
                        <span class="text-muted small text-uppercase fw-semibold">Placement Drives</span>
                        <div class="d-flex align-items-baseline justify-content-between mt-2">
                            <h3 class="fw-bold text-purple-deep mb-0">{{ stats.drives || 0 }}</h3>
                            <span class="badge bg-warning text-dark" v-if="stats.pending_drives_count > 0">
                                <i class="bi bi-hourglass-split me-1"></i>{{ stats.pending_drives_count }} Pending
                            </span>
                            <span class="badge bg-success-subtle text-success" v-else>Approved</span>
                        </div>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="metric-box h-100 d-flex flex-column justify-content-between">
                        <span class="text-muted small text-uppercase fw-semibold">Placement Ratio</span>
                        <div class="d-flex align-items-baseline justify-content-between mt-2">
                            <h3 class="fw-bold text-purple-vibrant mb-0">{{ stats.placement_ratio || 0 }}%</h3>
                            <span class="text-muted small">{{ stats.placed_students || 0 }} Placed</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Navigation Tabs -->
            <ul class="nav nav-tabs nav-tabs-purple mb-4">
                <li class="nav-item">
                    <button class="nav-link" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">
                        Pending Approvals
                        <span class="badge bg-danger rounded-pill ms-1" v-if="pendingTotal > 0">{{ pendingTotal }}</span>
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{ active: activeTab === 'companies' }" @click="activeTab = 'companies'">
                        Companies
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{ active: activeTab === 'drives' }" @click="activeTab = 'drives'">
                        Placement Drives
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">
                        User Directory
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{ active: activeTab === 'applications' }" @click="activeTab = 'applications'">
                        Applications Master
                    </button>
                </li>
            </ul>

            <!-- TAB 1: PENDING APPROVALS -->
            <div v-if="activeTab === 'pending'">
                <div class="row g-4">
                    <div class="col-lg-6">
                        <div class="card card-custom h-100">
                            <div class="card-header card-header-lavender py-3">
                                <h5 class="fw-bold mb-0 text-purple-deep">Pending Company Profiles</h5>
                            </div>
                            <div class="card-body p-0">
                                <div v-if="pendingCompanies.length === 0" class="p-4 text-center text-muted">
                                    No pending company registration requests.
                                </div>
                                <div v-else class="table-responsive">
                                    <table class="table align-middle mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Company</th>
                                                <th>Contact</th>
                                                <th class="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="c in pendingCompanies" :key="c.profile_id">
                                                <td>
                                                    <div class="fw-bold">{{ c.company_name || 'Unnamed Company' }}</div>
                                                    <small class="text-muted">{{ c.industry || 'General' }}</small>
                                                </td>
                                                <td>
                                                    <div>{{ c.contact_person || 'N/A' }}</div>
                                                    <small class="text-muted">{{ c.email }}</small>
                                                </td>
                                                <td class="text-end">
                                                    <button @click="approveCompany(c.profile_id)" class="btn btn-success btn-sm me-1 rounded-2">Approve</button>
                                                    <button @click="rejectCompany(c.profile_id)" class="btn btn-outline-danger btn-sm rounded-2">Reject</button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-6">
                        <div class="card card-custom h-100">
                            <div class="card-header card-header-lavender py-3">
                                <h5 class="fw-bold mb-0 text-purple-deep">Pending Placement Drives</h5>
                            </div>
                            <div class="card-body p-0">
                                <div v-if="pendingDrives.length === 0" class="p-4 text-center text-muted">
                                    No pending placement drive requests.
                                </div>
                                <div v-else class="table-responsive">
                                    <table class="table align-middle mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Drive Info</th>
                                                <th>Salary</th>
                                                <th class="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="d in pendingDrives" :key="d.id">
                                                <td>
                                                    <div class="fw-bold">{{ d.job_title }}</div>
                                                    <small class="text-purple-vibrant font-weight-semibold">{{ d.company_name }}</small>
                                                </td>
                                                <td>{{ d.salary_range || 'N/A' }}</td>
                                                <td class="text-end">
                                                    <button @click="approveDrive(d.id)" class="btn btn-success btn-sm me-1 rounded-2">Approve</button>
                                                    <button @click="rejectDrive(d.id)" class="btn btn-outline-danger btn-sm rounded-2">Reject</button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 2: COMPANIES DIRECTORY -->
            <div v-if="activeTab === 'companies'">
                <div class="card card-custom">
                    <div class="card-header card-header-lavender py-3">
                        <h5 class="fw-bold mb-0 text-purple-deep">Registered Companies</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Company</th>
                                        <th>Industry</th>
                                        <th>Email</th>
                                        <th>Approval Status</th>
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="c in companies" :key="c.profile_id">
                                        <td class="fw-bold">{{ c.company_name || 'N/A' }}</td>
                                        <td>{{ c.industry || 'N/A' }}</td>
                                        <td>{{ c.email }}</td>
                                        <td>
                                            <span class="badge" :class="{
                                                'bg-success': c.approval_status === 'Approved',
                                                'bg-warning text-dark': c.approval_status === 'Pending',
                                                'bg-danger': c.approval_status === 'Rejected'
                                            }">
                                                <i class="bi bi-hourglass-split me-1" v-if="c.approval_status === 'Pending'"></i>{{ c.approval_status }}
                                            </span>
                                        </td>
                                        <td class="text-end">
                                            <button v-if="c.approval_status === 'Pending'" @click="approveCompany(c.profile_id)" class="btn btn-success btn-sm me-1 rounded-2">Approve</button>
                                            <button @click="toggleUserStatus(c.user_id)" class="btn btn-sm rounded-2" :class="c.is_active === 1 ? 'btn-outline-danger' : 'btn-outline-success'">
                                                {{ c.is_active === 1 ? 'Deactivate' : 'Reactivate' }}
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 3: PLACEMENT DRIVES -->
            <div v-if="activeTab === 'drives'">
                <div class="card card-custom">
                    <div class="card-header card-header-lavender py-3">
                        <h5 class="fw-bold mb-0 text-purple-deep">Placement Drives</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Title & Company</th>
                                        <th>Skills</th>
                                        <th>Salary</th>
                                        <th>Status</th>
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="d in drives" :key="d.id">
                                        <td>
                                            <div class="fw-bold">{{ d.job_title }}</div>
                                            <small class="text-purple-vibrant">{{ d.company_name }}</small>
                                        </td>
                                        <td><small>{{ d.skills_required || 'N/A' }}</small></td>
                                        <td>{{ d.salary_range || 'N/A' }}</td>
                                        <td>
                                            <span class="badge" :class="{
                                                'bg-success': d.status === 'Approved',
                                                'bg-warning text-dark': d.status === 'Pending',
                                                'bg-danger': d.status === 'Rejected'
                                            }">
                                                <i class="bi bi-hourglass-split me-1" v-if="d.status === 'Pending'"></i>{{ d.status }}
                                            </span>
                                        </td>
                                        <td class="text-end">
                                            <button v-if="d.status === 'Pending'" @click="approveDrive(d.id)" class="btn btn-success btn-sm me-1 rounded-2">Approve</button>
                                            <button @click="deleteDrive(d.id)" class="btn btn-outline-danger btn-sm rounded-2">Delete</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 4: USER DIRECTORY -->
            <div v-if="activeTab === 'users'">
                <div class="card card-custom">
                    <div class="card-header card-header-lavender py-3">
                        <div class="row align-items-center g-2">
                            <div class="col-md-6">
                                <h5 class="fw-bold mb-0 text-purple-deep">User Directory</h5>
                            </div>
                            <div class="col-md-6">
                                <input type="text" v-model="searchQuery" @input="fetchUsers" class="form-control form-control-sm rounded-3" placeholder="Search by name, email, or ID...">
                            </div>
                        </div>
                    </div>

                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Name</th>
                                        <th>Role</th>
                                        <th>Email</th>
                                        <th>Account Status</th>
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="u in users" :key="u.user_id">
                                        <td class="fw-bold">{{ u.name || 'N/A' }}</td>
                                        <td><span class="badge badge-lavender text-uppercase">{{ u.role }}</span></td>
                                        <td>{{ u.email }}</td>
                                        <td>
                                            <span class="badge" :class="u.is_active === 1 ? 'bg-success' : 'bg-danger'">
                                                {{ u.is_active === 1 ? 'Active' : 'Blacklisted' }}
                                            </span>
                                        </td>
                                        <td class="text-end">
                                            <button @click="toggleUserStatus(u.user_id)" class="btn btn-sm rounded-2" :class="u.is_active === 1 ? 'btn-outline-danger' : 'btn-outline-success'">
                                                {{ u.is_active === 1 ? 'Blacklist' : 'Activate' }}
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 5: APPLICATIONS MASTER -->
            <div v-if="activeTab === 'applications'">
                <div class="card card-custom">
                    <div class="card-header card-header-lavender py-3">
                        <h5 class="fw-bold mb-0 text-purple-deep">Master Student Applications</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Student</th>
                                        <th>Drive</th>
                                        <th>Applied On</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="a in applications" :key="a.id">
                                        <td>
                                            <div class="fw-bold">{{ a.student_name }}</div>
                                            <small class="text-muted">{{ a.student_email }}</small>
                                        </td>
                                        <td>
                                            <div class="fw-bold">{{ a.job_title }}</div>
                                            <small class="text-purple-vibrant">{{ a.company_name }}</small>
                                        </td>
                                        <td>{{ a.applied_at }}</td>
                                        <td>
                                            <span class="badge" :class="{
                                                'bg-primary': a.status === 'Applied',
                                                'bg-info text-dark': a.status === 'Shortlisted',
                                                'bg-success': a.status === 'Selected',
                                                'bg-danger': a.status === 'Rejected'
                                            }">{{ a.status }}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const activeTab = ref('pending');
        const stats = ref({});
        const companies = ref([]);
        const drives = ref([]);
        const users = ref([]);
        const applications = ref([]);
        const searchQuery = ref('');
        const alertMessage = ref('');
        const errorMessage = ref('');

        const pendingCompanies = computed(() => companies.value.filter(c => c.approval_status === 'Pending'));
        const pendingDrives = computed(() => drives.value.filter(d => d.status === 'Pending'));
        const pendingTotal = computed(() => pendingCompanies.value.length + pendingDrives.value.length);

        const getHeaders = () => {
            const token = localStorage.getItem('token');
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
        };

        const loadAdminData = async () => {
            errorMessage.value = '';
            try {
                const headers = getHeaders();
                const [sRes, cRes, dRes, uRes, aRes] = await Promise.all([
                    fetch('/api/admin/stats', { headers }),
                    fetch('/api/admin/companies', { headers }),
                    fetch('/api/admin/drives', { headers }),
                    fetch(`/api/admin/users?query=${encodeURIComponent(searchQuery.value)}`, { headers }),
                    fetch('/api/admin/applications', { headers })
                ]);

                if (sRes.ok) stats.value = await sRes.json();
                if (cRes.ok) companies.value = await cRes.json();
                if (dRes.ok) drives.value = await dRes.json();
                if (uRes.ok) users.value = await uRes.json();
                if (aRes.ok) applications.value = await aRes.json();
            } catch (err) {
                errorMessage.value = 'Failed to load admin management data.';
            }
        };

        const approveCompany = async (id) => {
            try {
                const res = await fetch(`/api/admin/companies/${id}/approve`, { method: 'POST', headers: getHeaders() });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadAdminData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const rejectCompany = async (id) => {
            try {
                const res = await fetch(`/api/admin/companies/${id}/reject`, { method: 'POST', headers: getHeaders() });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadAdminData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const approveDrive = async (id) => {
            try {
                const res = await fetch(`/api/admin/drives/${id}/approve`, { method: 'POST', headers: getHeaders() });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadAdminData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const rejectDrive = async (id) => {
            try {
                const res = await fetch(`/api/admin/drives/${id}/reject`, { method: 'POST', headers: getHeaders() });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadAdminData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const deleteDrive = async (id) => {
            if (!confirm('Are you sure you want to delete this placement drive?')) return;
            try {
                const res = await fetch(`/api/admin/drives/${id}`, { method: 'DELETE', headers: getHeaders() });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadAdminData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const toggleUserStatus = async (userId) => {
            try {
                const res = await fetch(`/api/admin/users/${userId}/toggle-status`, { method: 'POST', headers: getHeaders() });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadAdminData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const fetchUsers = async () => {
            try {
                const res = await fetch(`/api/admin/users?query=${encodeURIComponent(searchQuery.value)}`, { headers: getHeaders() });
                if (res.ok) users.value = await res.json();
            } catch (err) { }
        };

        onMounted(() => {
            loadAdminData();
        });

        return {
            activeTab, stats, companies, drives, users, applications, searchQuery,
            alertMessage, errorMessage, pendingCompanies, pendingDrives, pendingTotal, 
            loadAdminData, approveCompany, rejectCompany, approveDrive, rejectDrive, deleteDrive, toggleUserStatus, fetchUsers
        };
    }
};

const CompanyDashboardView = {
    template: `
        <div class="py-2">
            <!-- Header Bar -->
            <div class="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h2 class="fw-bold mb-1 text-purple-deep">Company Console</h2>
                    <p class="text-muted mb-0">Ascentia Corporate Recruitment Portal</p>
                </div>
                <button @click="showCreateModal = true" class="btn btn-purple px-4 py-2.5 rounded-pill shadow-sm">
                    Post Placement Drive
                </button>
            </div>

            <!-- Toast Alerts -->
            <div v-if="alertMessage" class="alert alert-success alert-dismissible fade show mb-4" role="alert">
                {{ alertMessage }}
                <button type="button" class="btn-close" @click="alertMessage = ''"></button>
            </div>
            <div v-if="errorMessage" class="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                {{ errorMessage }}
                <button type="button" class="btn-close" @click="errorMessage = ''"></button>
            </div>

            <!-- Profile Summary Card -->
            <div class="card card-custom p-4 mb-4">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h4 class="fw-bold mb-1 text-purple-deep">{{ profile.company_name || 'Corporate Account' }}</h4>
                        <p class="text-muted mb-0 small">
                            {{ profile.location || 'Location Not Set' }} • {{ profile.industry || 'General Industry' }} • {{ profile.email }}
                        </p>
                    </div>
                    <div class="col-md-4 text-md-end mt-3 mt-md-0">
                        <button @click="openEditCompanyModal" class="btn btn-outline-purple btn-sm rounded-pill me-2">
                            <i class="bi bi-pencil me-1"></i> Edit Profile
                        </button>
                        <span class="badge px-3 py-2 fs-6 rounded-pill" :class="{
                            'bg-success': profile.approval_status === 'Approved',
                            'bg-warning text-dark': profile.approval_status === 'Pending',
                            'bg-danger': profile.approval_status === 'Rejected'
                        }">
                            <i class="bi bi-hourglass-split me-1" v-if="profile.approval_status === 'Pending'"></i>Status: {{ profile.approval_status }}
                        </span>
                    </div>

                </div>
            </div>

            <!-- Drives Table -->
            <div class="card card-custom mb-4">
                <div class="card-header card-header-lavender py-3 d-flex justify-content-between align-items-center">
                    <h5 class="fw-bold mb-0 text-purple-deep">Your Placement Drives</h5>
                    <button @click="loadCompanyData" class="btn btn-outline-secondary btn-sm rounded-pill"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
                </div>
                <div class="card-body p-0">
                    <div v-if="drives.length === 0" class="p-4 text-center text-muted">
                        No placement drives posted yet.
                        <div class="mt-2">
                            <button @click="showCreateModal = true" class="btn btn-purple btn-sm rounded-pill px-3">Create First Drive</button>
                        </div>
                    </div>
                    <div v-else class="table-responsive">
                        <table class="table align-middle mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Job Title</th>
                                    <th>Salary</th>
                                    <th>Skills Required</th>
                                    <th>Deadline</th>
                                    <th>Admin Status</th>
                                    <th>Drive State</th>
                                    <th>Applicants</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="d in drives" :key="d.id">
                                    <td class="fw-bold">{{ d.job_title }}</td>
                                    <td>{{ d.salary_range || 'N/A' }}</td>
                                    <td><small class="text-muted">{{ d.skills_required || 'General' }}</small></td>
                                    <td><small>{{ d.application_deadline || 'Open' }}</small></td>
                                    <td>
                                        <span class="badge" :class="{
                                            'bg-success': d.status === 'Approved',
                                            'bg-warning text-dark': d.status === 'Pending',
                                            'bg-danger': d.status === 'Rejected'
                                        }">
                                            <i class="bi bi-hourglass-split me-1" v-if="d.status === 'Pending'"></i>{{ d.status }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge" :class="d.drive_status === 'Active' ? 'bg-primary' : 'bg-secondary'">
                                            {{ d.drive_status }}
                                        </span>
                                    </td>
                                    <td><span class="badge badge-lavender px-2 py-1">{{ d.applicant_count }} Candidates</span></td>
                                    <td class="text-end">
                                        <button @click="viewApplicants(d)" class="btn btn-outline-primary btn-sm me-1 rounded-pill">
                                            Review ({{ d.applicant_count }})
                                        </button>
                                        <button @click="exportDriveCSV(d.id)" class="btn btn-outline-success btn-sm me-1 rounded-pill">
                                            Export CSV
                                        </button>
                                        <button @click="toggleDriveState(d)" class="btn btn-sm me-1 rounded-pill" :class="d.drive_status === 'Active' ? 'btn-outline-warning' : 'btn-outline-success'">
                                            {{ d.drive_status === 'Active' ? 'Close' : 'Activate' }}
                                        </button>
                                        <button @click="deleteDrive(d.id)" class="btn btn-outline-danger btn-sm rounded-pill">Delete</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- APPLICANT REVIEW DRAWER -->
            <div v-if="selectedDrive" class="card card-custom border-purple mb-4">
                <div class="card-header card-header-lavender py-3 d-flex justify-content-between align-items-center">
                    <h5 class="fw-bold mb-0 text-purple-deep">Applicants for: {{ selectedDrive.job_title }}</h5>
                    <div>
                        <button @click="exportDriveCSV(selectedDrive.id)" class="btn btn-sm btn-success rounded-pill me-2">Export CSV</button>
                        <button @click="selectedDrive = null" class="btn btn-sm btn-outline-secondary rounded-circle">X</button>
                    </div>
                </div>

                <div class="card-body p-0">
                    <div v-if="applicants.length === 0" class="p-4 text-center text-muted">
                        No student applications received yet for this drive.
                    </div>
                    <div v-else class="table-responsive">
                        <table class="table align-middle mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Candidate</th>
                                    <th>Academics</th>
                                    <th>Skills</th>
                                    <th>Applied On</th>
                                    <th>Status</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="a in applicants" :key="a.application_id">
                                    <td>
                                        <div class="fw-bold">{{ a.full_name }}</div>
                                        <small class="text-muted">{{ a.email }}</small>
                                    </td>
                                    <td>
                                        <div>{{ a.branch || 'N/A' }} (Year {{ a.year || 'N/A' }})</div>
                                        <small class="fw-bold text-success">CGPA: {{ a.cgpa || 'N/A' }}</small>
                                    </td>
                                    <td><small class="text-muted">{{ a.skills || 'N/A' }}</small></td>
                                    <td><small>{{ a.applied_at }}</small></td>
                                    <td>
                                        <span class="badge" :class="{
                                            'bg-primary': a.status === 'Applied',
                                            'bg-info text-dark': a.status === 'Shortlisted',
                                            'bg-success': a.status === 'Selected',
                                            'bg-danger': a.status === 'Rejected'
                                        }">{{ a.status }}</span>
                                    </td>
                                    <td class="text-end">
                                        <button @click="openStatusModal(a)" class="btn btn-purple btn-sm rounded-pill">
                                            Update Status
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- CREATE PLACEMENT DRIVE MODAL -->
            <div v-if="showCreateModal" class="modal d-block tab-pane fade show" style="background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 shadow">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title fw-bold text-purple-deep">Post New Placement Drive</h5>
                            <button type="button" class="btn-close" @click="showCreateModal = false"></button>
                        </div>
                        <form @submit.prevent="createDrive">
                            <div class="modal-body p-4">
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Job Title *</label>
                                    <input type="text" v-model="driveForm.job_title" class="form-control" placeholder="e.g. Software Engineer" required>
                                </div>
                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label fw-semibold">Salary Range</label>
                                        <input type="text" v-model="driveForm.salary_range" class="form-control" placeholder="e.g. 8 - 12 LPA">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label fw-semibold">Application Deadline</label>
                                        <input type="date" v-model="driveForm.application_deadline" class="form-control">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Required Skills</label>
                                    <input type="text" v-model="driveForm.skills_required" class="form-control" placeholder="e.g. Python, Vue, SQL">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Eligibility Criteria</label>
                                    <input type="text" v-model="driveForm.eligibility_criteria" class="form-control" placeholder="e.g. CSE / IT, Min 7.5 CGPA">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Job Description</label>
                                    <textarea v-model="driveForm.description" class="form-control" rows="3" placeholder="Enter job description..."></textarea>
                                </div>
                            </div>
                            <div class="modal-footer border-0 pt-0">
                                <button type="button" class="btn btn-secondary rounded-pill" @click="showCreateModal = false">Cancel</button>
                                <button type="submit" class="btn btn-purple rounded-pill px-4" :disabled="creating">
                                    {{ creating ? 'Posting Drive...' : 'Submit Drive' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- UPDATE APPLICANT STATUS MODAL -->
            <div v-if="selectedApp" class="modal d-block tab-pane fade show" style="background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 shadow">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title fw-bold">Update Status: {{ selectedApp.full_name }}</h5>
                            <button type="button" class="btn-close" @click="selectedApp = null"></button>
                        </div>
                        <form @submit.prevent="updateApplicantStatus">
                            <div class="modal-body p-4">
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Status *</label>
                                    <select v-model="statusForm.status" class="form-select" required>
                                        <option value="Applied">Applied</option>
                                        <option value="Shortlisted">Shortlisted</option>
                                        <option value="Selected">Selected</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </div>
                                <div class="mb-3" v-if="statusForm.status === 'Shortlisted'">
                                    <label class="form-label fw-semibold">Interview Date & Time</label>
                                    <input type="datetime-local" v-model="statusForm.interview_date" class="form-control">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Feedback / Remarks</label>
                                    <textarea v-model="statusForm.feedback" class="form-control" rows="2" placeholder="Optional comments..."></textarea>
                                </div>
                            </div>
                            <div class="modal-footer border-0 pt-0">
                                <button type="button" class="btn btn-secondary rounded-pill" @click="selectedApp = null">Cancel</button>
                                <button type="submit" class="btn btn-purple rounded-pill px-4">Save Status</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- EDIT COMPANY PROFILE MODAL -->
            <div v-if="showEditCompanyModal" class="modal fade show d-block" style="background: rgba(0,0,0,0.5);">
                <div class="modal-dialog">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header card-header-lavender py-3">
                            <h5 class="modal-title fw-bold text-purple-deep">Edit Company Profile Details</h5>
                            <button type="button" class="btn-close" @click="showEditCompanyModal = false"></button>
                        </div>
                        <form @submit.prevent="updateCompanyProfile">
                            <div class="modal-body p-4">
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Full Company Name</label>
                                    <input type="text" v-model="companyProfileForm.company_name" class="form-control" required>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label fw-semibold">Industry</label>
                                        <input type="text" v-model="companyProfileForm.industry" class="form-control" placeholder="e.g. Robotics & Automation">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label fw-semibold">Location / HQ</label>
                                        <input type="text" v-model="companyProfileForm.location" class="form-control" placeholder="e.g. Bangalore, India">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Website URL</label>
                                    <input type="url" v-model="companyProfileForm.website" class="form-control" placeholder="https://cynlr.com">
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label fw-semibold">Contact Person</label>
                                        <input type="text" v-model="companyProfileForm.contact_person" class="form-control" placeholder="e.g. HR Manager">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label fw-semibold">Phone Number</label>
                                        <input type="text" v-model="companyProfileForm.phone" class="form-control" placeholder="+91 9876543210">
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer border-0 pt-0">
                                <button type="button" class="btn btn-secondary rounded-pill" @click="showEditCompanyModal = false">Cancel</button>
                                <button type="submit" class="btn btn-purple rounded-pill px-4">Save Profile</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const profile = ref({});
        const drives = ref([]);
        const selectedDrive = ref(null);
        const applicants = ref([]);
        const showCreateModal = ref(false);
        const showEditCompanyModal = ref(false);
        const creating = ref(false);
        const selectedApp = ref(null);
        const alertMessage = ref('');
        const errorMessage = ref('');

        const companyProfileForm = reactive({
            company_name: '', industry: '', location: '', website: '', contact_person: '', phone: ''
        });

        const openEditCompanyModal = () => {
            companyProfileForm.company_name = profile.value.company_name || '';
            companyProfileForm.industry = profile.value.industry || '';
            companyProfileForm.location = profile.value.location || '';
            companyProfileForm.website = profile.value.website || '';
            companyProfileForm.contact_person = profile.value.contact_person || '';
            companyProfileForm.phone = profile.value.phone || '';
            showEditCompanyModal.value = true;
        };

        const updateCompanyProfile = async () => {
            try {
                const res = await fetch('/api/company/profile', {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(companyProfileForm)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                showEditCompanyModal.value = false;
                loadCompanyData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };


        const driveForm = reactive({
            job_title: '', salary_range: '', application_deadline: '', skills_required: '', eligibility_criteria: '', description: ''
        });

        const statusForm = reactive({
            status: 'Shortlisted', feedback: '', interview_date: ''
        });

        const getHeaders = () => {
            const token = localStorage.getItem('token');
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
        };

        const loadCompanyData = async () => {
            errorMessage.value = '';
            try {
                const headers = getHeaders();
                const [pRes, dRes] = await Promise.all([
                    fetch('/api/company/profile', { headers }),
                    fetch('/api/company/drives', { headers })
                ]);
                if (pRes.ok) profile.value = await pRes.json();
                if (dRes.ok) drives.value = await dRes.json();
            } catch (err) {
                errorMessage.value = 'Failed to load company workspace data.';
            }
        };

        const createDrive = async () => {
            creating.value = true;
            errorMessage.value = '';
            try {
                const res = await fetch('/api/company/drives', {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(driveForm)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                showCreateModal.value = false;
                Object.assign(driveForm, { job_title: '', salary_range: '', application_deadline: '', skills_required: '', eligibility_criteria: '', description: '' });
                loadCompanyData();
            } catch (err) {
                errorMessage.value = err.message;
            } finally {
                creating.value = false;
            }
        };

        const toggleDriveState = async (drive) => {
            const newStatus = drive.drive_status === 'Active' ? 'Closed' : 'Active';
            try {
                const res = await fetch(`/api/company/drives/${drive.id}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify({ drive_status: newStatus })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadCompanyData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const deleteDrive = async (id) => {
            if (!confirm('Are you sure you want to delete this placement drive?')) return;
            try {
                const res = await fetch(`/api/company/drives/${id}`, { method: 'DELETE', headers: getHeaders() });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadCompanyData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const viewApplicants = async (drive) => {
            selectedDrive.value = drive;
            try {
                const res = await fetch(`/api/company/drives/${drive.id}/applicants`, { headers: getHeaders() });
                const data = await res.json();
                if (res.ok) {
                    applicants.value = data.applicants;
                }
            } catch (err) {
                errorMessage.value = 'Failed to load candidate applicants.';
            }
        };

        const openStatusModal = (app) => {
            selectedApp.value = app;
            statusForm.status = app.status;
            statusForm.feedback = app.feedback || '';
            statusForm.interview_date = app.interview_date || '';
        };

        const updateApplicantStatus = async () => {
            try {
                const res = await fetch(`/api/company/applications/${selectedApp.value.application_id}/status`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(statusForm)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                selectedApp.value = null;
                if (selectedDrive.value) viewApplicants(selectedDrive.value);
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const exportDriveCSV = async (driveId) => {
            try {
                const res = await fetch(`/api/company/drives/${driveId}/export-csv`, {
                    method: 'POST',
                    headers: getHeaders()
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                if (data.result && data.result.download_url) {
                    window.open(data.result.download_url, '_blank');
                }
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        onMounted(() => {
            loadCompanyData();
        });

        return {
            profile, drives, selectedDrive, applicants, showCreateModal, showEditCompanyModal, creating, selectedApp,
            alertMessage, errorMessage, driveForm, statusForm, companyProfileForm,
            loadCompanyData, createDrive, toggleDriveState, deleteDrive, viewApplicants, openStatusModal, updateApplicantStatus, exportDriveCSV,
            openEditCompanyModal, updateCompanyProfile
        };
    }
};



const StudentDashboardView = {
    template: `
        <div class="py-2">
            <!-- Header Bar -->
            <div class="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h2 class="fw-bold mb-1 text-purple-deep">Student Placement Portal</h2>
                    <p class="text-muted mb-0">Browse recruitment drives, submit job applications, and view selection progress.</p>
                </div>
                <button @click="showEditModal = true" class="btn btn-purple px-4 py-2.5 rounded-pill shadow-sm">
                    Edit Student Profile
                </button>
            </div>

            <!-- Toast Alerts -->
            <div v-if="alertMessage" class="alert alert-success alert-dismissible fade show mb-4" role="alert">
                {{ alertMessage }}
                <button type="button" class="btn-close" @click="alertMessage = ''"></button>
            </div>
            <div v-if="errorMessage" class="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                {{ errorMessage }}
                <button type="button" class="btn-close" @click="errorMessage = ''"></button>
            </div>

            <!-- Profile Summary Card -->
            <div class="card card-custom p-4 mb-4">
                <div class="row align-items-center">
                    <div class="col-md-2 text-center text-md-start mb-3 mb-md-0">
                        <img :src="profile.profile_pic || 'https://via.placeholder.com/100?text=Student'" class="rounded-circle border border-2 border-purple p-1" style="width: 90px; height: 90px; object-fit: cover;">
                        <div class="mt-2">
                            <label class="btn btn-outline-secondary btn-sm rounded-pill px-2 py-0" style="font-size: 0.75rem;">
                                Upload Photo
                                <input type="file" @change="uploadPhoto" class="d-none" accept="image/*">
                            </label>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <h4 class="fw-bold mb-1 text-purple-deep">{{ profile.full_name || 'Student Candidate' }}</h4>
                        <p class="text-muted mb-1 small">
                            <span class="fw-semibold text-dark">{{ profile.branch || 'Branch N/A' }}</span> • 
                            Year {{ profile.year || 'N/A' }} • 
                            CGPA: <span class="fw-bold text-success">{{ profile.cgpa || 'N/A' }}</span>
                        </p>
                        <p class="text-muted mb-0 small">
                            Skills: {{ profile.skills || 'Not specified' }}
                        </p>
                    </div>
                    <div class="col-md-4 text-md-end mt-3 mt-md-0">
                        <div class="mb-2">
                            <span class="badge badge-lavender px-3 py-2 fs-6 rounded-pill">
                                {{ profile.placement_status }}
                            </span>
                        </div>
                        <div class="small text-muted mb-1">Profile Completion: {{ profile.progress_percent || 0 }}%</div>
                        <div class="progress rounded-pill" style="height: 8px;">
                            <div class="progress-bar bg-purple-vibrant" :style="{ width: (profile.progress_percent || 0) + '%' }"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Navigation Tabs -->
            <ul class="nav nav-tabs nav-tabs-purple mb-4">
                <li class="nav-item">
                    <button class="nav-link" :class="{ active: activeTab === 'drives' }" @click="activeTab = 'drives'">
                        Approved Placement Drives
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{ active: activeTab === 'applications' }" @click="activeTab = 'applications'">
                        My Applications
                        <span class="badge bg-secondary rounded-pill ms-1" v-if="applications.length > 0">{{ applications.length }}</span>
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{ active: activeTab === 'placements' }" @click="activeTab = 'placements'">
                        Offers & Placements
                        <span class="badge bg-success rounded-pill ms-1" v-if="placements.length > 0">{{ placements.length }}</span>
                    </button>
                </li>
            </ul>

            <!-- TAB 1: PLACEMENT DRIVES -->
            <div v-if="activeTab === 'drives'">
                <div class="card card-custom mb-4">
                    <div class="card-header card-header-lavender py-3">
                        <div class="row align-items-center g-2">
                            <div class="col-md-6">
                                <h5 class="fw-bold mb-0 text-purple-deep">Active Campus Placement Drives</h5>
                            </div>
                            <div class="col-md-6">
                                <input type="text" v-model="searchQuery" @input="fetchDrives" class="form-control form-control-sm rounded-3" placeholder="Search by job title, company, or skills...">
                            </div>
                        </div>
                    </div>
                    <div class="card-body p-4">
                        <div v-if="drives.length === 0" class="p-4 text-center text-muted">
                            No approved active placement drives match your search criteria.
                        </div>
                        <div v-else class="row g-4">
                            <div class="col-md-6 col-lg-4" v-for="d in drives" :key="d.id">
                                <div class="card h-100 card-custom border-purple p-3 d-flex flex-column justify-content-between">
                                    <div>
                                        <div class="d-flex justify-content-between align-items-start mb-2">
                                            <h5 class="fw-bold mb-0 text-purple-deep">{{ d.job_title }}</h5>
                                            <span class="badge bg-success-subtle text-success fs-7">Active</span>
                                        </div>
                                        <h6 class="fw-semibold text-purple-vibrant mb-2">{{ d.company_name }}</h6>
                                        <div class="small text-muted mb-2">
                                            <div><strong>Salary:</strong> {{ d.salary_range || 'As per industry' }}</div>
                                            <div><strong>Deadline:</strong> {{ d.application_deadline || 'Open' }}</div>
                                            <div v-if="d.eligibility_criteria" class="mt-1">
                                                <strong>Eligibility:</strong> {{ d.eligibility_criteria }}
                                            </div>
                                        </div>
                                        <div class="mb-3" v-if="d.skills_required">
                                            <small class="text-muted">Skills:</small>
                                            <div>
                                                <span class="badge badge-lavender me-1 mb-1" v-for="skill in d.skills_required.split(',')" :key="skill">
                                                    {{ skill.trim() }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="pt-3 border-top mt-2">
                                        <button v-if="!d.has_applied" @click="applyDrive(d.id)" class="btn btn-purple btn-sm w-100 rounded-pill py-2">
                                            Apply Now
                                        </button>
                                        <button v-else class="btn btn-success btn-sm w-100 rounded-pill py-2" disabled>
                                            Already Applied
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 2: MY APPLICATIONS -->
            <div v-if="activeTab === 'applications'">
                <div class="card card-custom">
                    <div class="card-header card-header-lavender py-3">
                        <h5 class="fw-bold mb-0 text-purple-deep">Submitted Job Applications</h5>
                    </div>
                    <div class="card-body p-0">
                        <div v-if="applications.length === 0" class="p-4 text-center text-muted">
                            You have not submitted any placement applications yet.
                        </div>
                        <div v-else class="table-responsive">
                            <table class="table align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Job Title & Company</th>
                                        <th>Applied Date</th>
                                        <th>Status</th>
                                        <th>Interview Schedule</th>
                                        <th>Company Feedback</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="a in applications" :key="a.application_id">
                                        <td>
                                            <div class="fw-bold">{{ a.job_title }}</div>
                                            <small class="text-purple-vibrant">{{ a.company_name }}</small>
                                        </td>
                                        <td><small>{{ a.applied_at }}</small></td>
                                        <td>
                                            <span class="badge" :class="{
                                                'bg-primary': a.status === 'Applied',
                                                'bg-info text-dark': a.status === 'Shortlisted',
                                                'bg-success': a.status === 'Selected',
                                                'bg-danger': a.status === 'Rejected'
                                            }">{{ a.status }}</span>
                                        </td>
                                        <td>
                                            <div v-if="a.interview_date" class="small fw-semibold text-purple-deep">
                                                {{ a.interview_date }}
                                            </div>
                                            <small class="text-muted" v-else>Not scheduled</small>
                                        </td>
                                        <td>
                                            <small class="text-muted">{{ a.feedback || 'None' }}</small>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 3: PLACEMENTS & OFFERS -->
            <div v-if="activeTab === 'placements'">
                <div class="card card-custom">
                    <div class="card-header card-header-lavender py-3">
                        <h5 class="fw-bold mb-0 text-purple-deep">Confirmed Placement Offers</h5>
                    </div>
                    <div class="card-body p-4">
                        <div v-if="placements.length === 0" class="p-4 text-center text-muted">
                            No placement offers confirmed yet.
                        </div>
                        <div v-else class="row g-4">
                            <div class="col-md-6" v-for="p in placements" :key="p.id">
                                <div class="card border-success p-4 rounded-4 shadow-sm bg-success-subtle">
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <h4 class="fw-bold text-success mb-0">Offer Confirmed!</h4>
                                        <span class="badge bg-success fs-6">Selected</span>
                                    </div>
                                    <h5 class="fw-bold text-dark mb-1">{{ p.position }}</h5>
                                    <p class="fw-semibold text-purple-deep mb-2">{{ p.company_name }}</p>
                                    <p class="mb-1"><strong>Offered CTC / Package:</strong> {{ p.salary || 'Standard Package' }}</p>
                                    <small class="text-muted">Confirmed on: {{ p.selected_at }}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- EDIT STUDENT PROFILE MODAL -->
            <div v-if="showEditModal" class="modal d-block tab-pane fade show" style="background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 shadow">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title fw-bold text-purple-deep">Edit Student Profile</h5>
                            <button type="button" class="btn-close" @click="showEditModal = false"></button>
                        </div>
                        <form @submit.prevent="updateProfile">
                            <div class="modal-body p-4">
                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label fw-semibold">Full Name *</label>
                                        <input type="text" v-model="profileForm.full_name" class="form-control" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label fw-semibold">Student / Roll Number</label>
                                        <input type="text" v-model="profileForm.student_id" class="form-control" placeholder="e.g. 24F2004166">
                                    </div>
                                </div>
                                <div class="row g-3 mb-3">
                                    <div class="col-md-4">
                                        <label class="form-label fw-semibold">Branch / Department</label>
                                        <input type="text" v-model="profileForm.branch" class="form-control" placeholder="e.g. Computer Science">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label fw-semibold">Academic Year</label>
                                        <select v-model="profileForm.year" class="form-select">
                                            <option value="">Select Year</option>
                                            <option value="1">1st Year</option>
                                            <option value="2">2nd Year</option>
                                            <option value="3">3rd Year</option>
                                            <option value="4">4th Year</option>
                                        </select>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label fw-semibold">CGPA</label>
                                        <input type="number" step="0.01" max="10" v-model="profileForm.cgpa" class="form-control" placeholder="e.g. 8.5">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Key Skills (Comma separated)</label>
                                    <input type="text" v-model="profileForm.skills" class="form-control" placeholder="e.g. Python, Flask, Vue.js, SQL, Machine Learning">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Resume URL / Link</label>
                                    <input type="url" v-model="profileForm.resume_link" class="form-control" placeholder="https://drive.google.com/your-resume-file">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Placement Status</label>
                                    <select v-model="profileForm.placement_status" class="form-select">
                                        <option value="Looking for Placement">Looking for Placement (Opt-In)</option>
                                        <option value="Opted Out">Opted Out</option>
                                        <option value="Placed">Placed</option>
                                    </select>
                                </div>
                            </div>
                            <div class="modal-footer border-0 pt-0">
                                <button type="button" class="btn btn-secondary rounded-pill" @click="showEditModal = false">Cancel</button>
                                <button type="submit" class="btn btn-purple rounded-pill px-4" :disabled="saving">
                                    {{ saving ? 'Saving Changes...' : 'Save Profile' }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const activeTab = ref('drives');
        const profile = ref({});
        const drives = ref([]);
        const applications = ref([]);
        const placements = ref([]);
        const showEditModal = ref(false);
        const saving = ref(false);
        const searchQuery = ref('');
        const alertMessage = ref('');
        const errorMessage = ref('');

        const profileForm = reactive({
            full_name: '', student_id: '', branch: '', year: '', cgpa: '', skills: '', resume_link: '', placement_status: 'Looking for Placement'
        });

        const getHeaders = () => {
            const token = localStorage.getItem('token');
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
        };

        const loadStudentData = async () => {
            errorMessage.value = '';
            try {
                const headers = getHeaders();
                const [pRes, aRes, plRes] = await Promise.all([
                    fetch('/api/student/profile', { headers }),
                    fetch('/api/student/applications', { headers }),
                    fetch('/api/student/placements', { headers })
                ]);
                if (pRes.ok) {
                    profile.value = await pRes.json();
                    Object.assign(profileForm, {
                        full_name: profile.value.full_name || '',
                        student_id: profile.value.student_id || '',
                        branch: profile.value.branch || '',
                        year: profile.value.year || '',
                        cgpa: profile.value.cgpa || '',
                        skills: profile.value.skills || '',
                        resume_link: profile.value.resume_link || '',
                        placement_status: profile.value.placement_status || 'Looking for Placement'
                    });
                }
                if (aRes.ok) applications.value = await aRes.json();
                if (plRes.ok) placements.value = await plRes.json();

                fetchDrives();
            } catch (err) {
                errorMessage.value = 'Failed to load student dashboard workspace data.';
            }
        };

        const fetchDrives = async () => {
            try {
                const res = await fetch(`/api/student/drives?query=${encodeURIComponent(searchQuery.value)}`, { headers: getHeaders() });
                if (res.ok) drives.value = await res.json();
            } catch (err) { }
        };

        const updateProfile = async () => {
            saving.value = true;
            errorMessage.value = '';
            try {
                const res = await fetch('/api/student/profile', {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(profileForm)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                showEditModal.value = false;
                loadStudentData();
            } catch (err) {
                errorMessage.value = err.message;
            } finally {
                saving.value = false;
            }
        };

        const uploadPhoto = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('profile_pic', file);

            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/student/upload-photo', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadStudentData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        const applyDrive = async (driveId) => {
            try {
                const res = await fetch(`/api/student/apply/${driveId}`, {
                    method: 'POST',
                    headers: getHeaders()
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alertMessage.value = data.message;
                loadStudentData();
            } catch (err) {
                errorMessage.value = err.message;
            }
        };

        onMounted(() => {
            loadStudentData();
        });

        return {
            activeTab, profile, drives, applications, placements, showEditModal, saving, searchQuery,
            alertMessage, errorMessage, profileForm,
            loadStudentData, fetchDrives, updateProfile, uploadPhoto, applyDrive
        };
    }
};

const PublicLandingView = {
    template: `
        <div class="py-3">
            <div class="card card-custom p-4 mb-4 text-center">
                <h1 class="fw-bold text-purple-deep">Ascentia Placement Cell Analytics</h1>
                <p class="lead text-muted max-w-700 mx-auto">
                    Real-time placement statistics, key hiring trends, and top required skills.
                </p>

                <div class="d-flex justify-content-center gap-3 mt-2">
                    <router-link v-if="!isAuthenticated" to="/login" class="btn btn-purple px-4 rounded-pill">Portal Sign In</router-link>
                    <router-link v-else :to="dashboardRoute" class="btn btn-purple px-4 rounded-pill"><i class="bi bi-speedometer2 me-1"></i> Back to My Dashboard</router-link>
                    <router-link to="/ats-screener" class="btn btn-outline-purple px-4 rounded-pill">ATS Resume Screener</router-link>
                </div>
            </div>

            <div class="row g-3 mb-4">
                <div class="col-md-3">
                    <div class="card card-custom text-center p-3">
                        <div class="fs-2 fw-bold text-purple-deep">{{ stats.total_drives || 0 }}</div>
                        <div class="text-muted small fw-semibold text-uppercase">Approved Drives</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card card-custom text-center p-3">
                        <div class="fs-2 fw-bold text-purple-vibrant">{{ stats.total_companies || 0 }}</div>
                        <div class="text-muted small fw-semibold text-uppercase">Hiring Partners</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card card-custom text-center p-3">
                        <div class="fs-2 fw-bold text-success">{{ stats.total_placements || 0 }}</div>
                        <div class="text-muted small fw-semibold text-uppercase">Placed Students</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card card-custom text-center p-3">
                        <div class="fs-2 fw-bold text-info">{{ stats.total_students || 0 }}</div>
                        <div class="text-muted small fw-semibold text-uppercase">Registered Candidates</div>
                    </div>
                </div>
            </div>

            <div class="row g-4 mb-4">
                <div class="col-md-7">
                    <div class="card card-custom p-3 h-100">
                        <h5 class="fw-bold text-purple-deep mb-3"><i class="bi bi-bar-chart-fill me-2"></i>Recruitment Activity Trends</h5>
                        <div style="position: relative; height: 260px;">
                            <canvas id="publicTrendsChart"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-md-5">
                    <div class="card card-custom p-3 h-100">
                        <h5 class="fw-bold text-purple-deep mb-3"><i class="bi bi-pie-chart-fill me-2"></i>Top In-Demand Skills</h5>
                        <div style="position: relative; height: 260px;">
                            <canvas id="publicSkillsChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const stats = ref({ total_students: 0, total_companies: 0, total_drives: 0, total_placements: 0, top_skills: [] });
        let trendsChartInstance = null;
        let skillsChartInstance = null;

        const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));
        const isAuthenticated = computed(() => !!localStorage.getItem('token') && !!user.value);
        const dashboardRoute = computed(() => {
            if (!user.value) return '/';
            if (user.value.role === 'admin') return '/admin';
            if (user.value.role === 'company') return '/company';
            return '/student';
        });

        const loadPublicStats = async () => {
            try {
                const res = await fetch('/api/public/stats');
                if (res.ok) {
                    stats.value = await res.json();
                    renderCharts();
                }
            } catch (err) {
                console.error('Failed to load public stats:', err);
            }
        };

        const renderCharts = () => {
            if (typeof Chart === 'undefined') return;

            const ctxTrends = document.getElementById('publicTrendsChart');
            if (ctxTrends) {
                if (trendsChartInstance) trendsChartInstance.destroy();
                trendsChartInstance = new Chart(ctxTrends, {
                    type: 'bar',
                    data: {
                        labels: ['Drives Approved', 'Candidates Placed', 'Hiring Companies'],
                        datasets: [{
                            label: 'Placement Metrics',
                            data: [stats.value.total_drives, stats.value.total_placements, stats.value.total_companies],
                            backgroundColor: ['#7e22ce', '#10b981', '#3b82f6']
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }

            const ctxSkills = document.getElementById('publicSkillsChart');
            if (ctxSkills) {
                const skillLabels = stats.value.top_skills.map(s => s.skill);
                const skillCounts = stats.value.top_skills.map(s => s.count);

                if (skillsChartInstance) skillsChartInstance.destroy();
                skillsChartInstance = new Chart(ctxSkills, {
                    type: 'doughnut',
                    data: {
                        labels: skillLabels.length ? skillLabels : ['Python', 'SQL', 'VueJS', 'Data Science'],
                        datasets: [{
                            data: skillCounts.length ? skillCounts : [12, 9, 7, 5],
                            backgroundColor: ['#7e22ce', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }
        };

        onMounted(() => {
            loadPublicStats();
        });

        return { stats, isAuthenticated, dashboardRoute };
    }
};


const AtsScreenerView = {
    template: `
        <div class="py-3">
            <div class="card card-custom p-4 mb-4 d-flex justify-content-between align-items-center flex-column flex-md-row gap-3">
                <div>
                    <h3 class="fw-bold text-purple-deep mb-1"><i class="bi bi-file-earmark-check me-2"></i>ATS Resume Screener & Matcher</h3>
                    <p class="text-muted mb-0">Compare candidate skills against job requirements to check ATS keyword alignment.</p>
                </div>
                <div v-if="isAuthenticated">
                    <router-link :to="dashboardRoute" class="btn btn-purple rounded-pill px-3">
                        <i class="bi bi-speedometer2 me-1"></i> Back to My Dashboard
                    </router-link>
                </div>
            </div>

            <div class="row g-4">
                <div class="col-md-6">
                    <div class="card card-custom p-4 h-100">
                        <h5 class="fw-bold text-purple-deep mb-3">1. Candidate Resume Text / Skills</h5>
                        <textarea v-model="resumeText" class="form-control mb-3" rows="8" placeholder="Paste candidate resume skills or full text (e.g. Python, SQL, REST APIs, Vue.js, Flask, Machine Learning)..."></textarea>

                        <h5 class="fw-bold text-purple-deep mb-3">2. Job Description / Requirements</h5>
                        <textarea v-model="jobText" class="form-control mb-3" rows="8" placeholder="Paste target job skills or description (e.g. Seeking Python Developer proficient in Flask, SQL, Docker, Redis)..."></textarea>

                        <button @click="analyzeATS" class="btn btn-purple w-100 py-2.5 rounded-pill fw-semibold" :disabled="!resumeText || !jobText">
                            Run ATS Resume Matcher
                        </button>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card card-custom p-4 h-100">
                        <h5 class="fw-bold text-purple-deep mb-3">ATS Analysis Results</h5>

                        <div v-if="!result" class="text-center py-5 text-muted">
                            <i class="bi bi-cpu fs-1 d-block mb-2 text-purple-vibrant"></i>
                            Paste resume and job requirements on the left, then click <strong>Run ATS Resume Matcher</strong>.
                        </div>

                        <div v-else>
                            <div class="text-center mb-4 p-3 bg-light rounded-3">
                                <div class="fs-6 text-muted fw-bold mb-1">ATS MATCH SCORE</div>
                                <div class="display-4 fw-bold" :class="scoreClass">
                                    {{ result.score }}%
                                </div>
                                <div class="fw-semibold text-muted">{{ result.rating }}</div>
                            </div>

                            <div class="mb-3">
                                <h6 class="fw-bold text-success"><i class="bi bi-check-circle me-1"></i>Matched Keywords ({{ result.matched.length }})</h6>
                                <div>
                                    <span v-for="s in result.matched" :key="s" class="badge bg-success me-1 mb-1">{{ s }}</span>
                                    <span v-if="result.matched.length === 0" class="text-muted small">No exact keyword matches found.</span>
                                </div>
                            </div>

                            <div class="mb-3">
                                <h6 class="fw-bold text-danger"><i class="bi bi-x-circle me-1"></i>Missing Keywords ({{ result.missing.length }})</h6>
                                <div>
                                    <span v-for="s in result.missing" :key="s" class="badge bg-danger me-1 mb-1">{{ s }}</span>
                                    <span v-if="result.missing.length === 0" class="text-muted small">Great job! All key requirements matched.</span>
                                </div>
                            </div>

                            <div>
                                <h6 class="fw-bold text-purple-deep"><i class="bi bi-lightbulb me-1"></i>Optimization Tips</h6>
                                <ul class="small text-muted mb-0 ps-3">
                                    <li v-for="tip in result.tips" :key="tip">{{ tip }}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const resumeText = ref('');
        const jobText = ref('');
        const result = ref(null);

        const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));
        const isAuthenticated = computed(() => !!localStorage.getItem('token') && !!user.value);
        const dashboardRoute = computed(() => {
            if (!user.value) return '/';
            if (user.value.role === 'admin') return '/admin';
            if (user.value.role === 'company') return '/company';
            return '/student';
        });

        const analyzeATS = () => {
            const extractKeywords = (text) => {
                return text.toLowerCase()
                    .replace(/[^a-z0-9\s,#+.-]/g, ' ')
                    .split(/[\s,;]+/)
                    .filter(w => w.length > 2);
            };

            const resumeTokens = new Set(extractKeywords(resumeText.value));
            const jobTokens = Array.from(new Set(extractKeywords(jobText.value)));

            if (jobTokens.length === 0) return;

            const matched = [];
            const missing = [];

            for (const token of jobTokens) {
                if (resumeTokens.has(token)) matched.push(token);
                else missing.push(token);
            }

            const score = Math.min(100, Math.round((matched.length / jobTokens.length) * 100));
            let rating = 'Needs Improvement';
            if (score >= 80) rating = 'Excellent Match!';
            else if (score >= 60) rating = 'Good Match';
            else if (score >= 40) rating = 'Moderate Match';

            const tips = [];
            if (missing.length > 0) {
                tips.push(`Incorporate top missing keywords: ${missing.slice(0, 4).join(', ')}.`);
            }
            tips.push('Use standard headings like Skills, Experience, and Education.');
            tips.push('Avoid using complex images, columns, or tables that confuse ATS parsers.');

            result.value = { score, rating, matched, missing, tips };
        };

        const scoreClass = computed(() => {
            if (!result.value) return '';
            if (result.value.score >= 80) return 'text-success';
            if (result.value.score >= 50) return 'text-warning';
            return 'text-danger';
        });

        return { resumeText, jobText, result, analyzeATS, scoreClass, isAuthenticated, dashboardRoute };
    }
};


const routes = [
    { path: '/', component: PublicLandingView },
    { path: '/ats-screener', component: AtsScreenerView },
    { path: '/login', component: LoginView, meta: { guestOnly: true } },
    { path: '/register', component: RegisterView, meta: { guestOnly: true } },
    { path: '/admin', component: AdminDashboardView, meta: { requiresAuth: true, role: 'admin' } },
    { path: '/company', component: CompanyDashboardView, meta: { requiresAuth: true, role: 'company' } },
    { path: '/student', component: StudentDashboardView, meta: { requiresAuth: true, role: 'student' } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (to.meta.requiresAuth) {
        if (!token || !user) {
            next('/login');
        } else if (to.meta.role && user.role !== to.meta.role) {
            if (user.role === 'admin') next('/admin');
            else if (user.role === 'company') next('/company');
            else next('/student');
        } else {
            next();
        }
    } else if (to.meta.guestOnly && token && user) {
        if (user.role === 'admin') next('/admin');
        else if (user.role === 'company') next('/company');
        else next('/student');
    } else {
        next();
    }
});

const app = createApp({
    delimiters: ['[[', ']]'],
    setup() {
        const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));

        const isAuthenticated = computed(() => !!localStorage.getItem('token') && !!user.value);
        const userEmail = computed(() => user.value ? user.value.email : '');
        const userRole = computed(() => user.value ? user.value.role : '');

        const dashboardRoute = computed(() => {
            if (!user.value) return '/';
            if (user.value.role === 'admin') return '/admin';
            if (user.value.role === 'company') return '/company';
            return '/student';
        });

        const updateAuth = () => {
            user.value = JSON.parse(localStorage.getItem('user') || 'null');
        };

        onMounted(() => {
            window.addEventListener('auth-changed', updateAuth);
        });

        const logout = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            updateAuth();
            router.push('/login');
        };

        return { isAuthenticated, userEmail, userRole, dashboardRoute, logout };

    }
});

app.use(router);
app.mount('#app');

