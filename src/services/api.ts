import {
  ApiResponse,
  LoginResponseData,
  UserDTO,
  CustomerDTO,
  CustomerDocumentDTO,
  LoanDTO,
  LoanProductDTO,
  LoanApplicationDTO,
  ApplicationNoteDTO,
  ApplicationDocumentDTO,
  CreditAssessmentDTO,
  WorkflowSettingsDTO,
  LoanPortfolioStatsDTO,
  PaymentTransactionDTO,
  PaymentReceiptDTO,
  AuditLogDTO,
  SystemHealthDTO,
  LoanStatus,
  LoanCalculationResultDTO,
  CustomerLoanSummaryDTO,
  LoanDisbursementDTO,
  DashboardSummaryDTO,
  ReportFilterOptionsDTO,
  ReportFilterParams,
  ReportResponseDTO,
  ReportType,
  NotificationDTO,
  NotificationSystemSettingsDTO,
  NotificationTypeRuleDTO,
  NotificationTemplateDTO,
  SmsProviderConfigDTO,
  EmailProviderConfigDTO,
  NotificationChannelType,
  NotificationEventType,
} from '../../shared/types/index.js';
import {
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateUserStatusInput,
  CreateUserByAdminInput,
} from '../../shared/validators/auth.js';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
  UpdateKycStatusInput,
  AddCustomerDocumentInput,
  VerifyCustomerDocumentInput,
} from '../../shared/validators/customer.js';
import {
  CreatePaymentInput,
  ReversePaymentInput,
} from '../../shared/validators/payment.js';
import {
  BulkUpdateSettingsInput,
} from '../../shared/validators/settings.js';
import {
  CreateLoanProductInput,
  UpdateLoanProductInput,
  CalculateLoanInput,
} from '../../shared/validators/product.js';
import {
  CreateLoanApplicationInput,
  UpdateLoanApplicationInput,
  UpdateLoanStatusInput,
  RecordPaymentInput,
  AddApplicationNoteInput,
  RecommendApplicationInput,
  CreditAssessmentInput,
  TransitionApplicationStatusInput,
  DisburseLoanInput,
} from '../../shared/validators/loan.js';

const API_BASE = '/api';

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.accessToken = localStorage.getItem('nexa_auth_token');
    this.refreshToken = localStorage.getItem('nexa_refresh_token');
  }

  public setTokens(access: string | null, refresh?: string | null) {
    this.accessToken = access;
    if (access) {
      localStorage.setItem('nexa_auth_token', access);
    } else {
      localStorage.removeItem('nexa_auth_token');
    }

    if (refresh !== undefined) {
      this.refreshToken = refresh;
      if (refresh) {
        localStorage.setItem('nexa_refresh_token', refresh);
      } else {
        localStorage.removeItem('nexa_refresh_token');
      }
    }
  }

  public getToken(): string | null {
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(url, { ...options, headers });

      // Handle 401 with Token Refresh attempt
      if (response.status === 401 && this.refreshToken && !endpoint.includes('/auth/')) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: this.refreshToken }),
            });

            if (refreshRes.ok) {
              const resData = (await refreshRes.json()) as { data: { token: string; refreshToken: string } };
              this.setTokens(resData.data.token, resData.data.refreshToken);
              this.isRefreshing = false;
              this.onTokenRefreshed(resData.data.token);

              // Retry original request with new token
              headers['Authorization'] = `Bearer ${resData.data.token}`;
              response = await fetch(url, { ...options, headers });
            } else {
              this.isRefreshing = false;
              this.setTokens(null, null);
              window.location.reload();
            }
          } catch {
            this.isRefreshing = false;
            this.setTokens(null, null);
          }
        } else {
          // Queue request until refresh completes
          const retryToken = await new Promise<string>((resolve) => {
            this.addRefreshSubscriber((token) => resolve(token));
          });
          headers['Authorization'] = `Bearer ${retryToken}`;
          response = await fetch(url, { ...options, headers });
        }
      }

      const data = (await response.json()) as ApiResponse<T>;

      if (!response.ok || !data.success) {
        const errorMsg =
          !data.success && 'error' in data
            ? data.error.message
            : `Request failed with HTTP status ${response.status}`;
        const error = new Error(errorMsg) as Error & { details?: unknown; code?: string };
        if (!data.success && 'error' in data) {
          error.code = data.error.code;
          error.details = data.error.details;
        }
        throw error;
      }

      return data.data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  }

  // ----------------------------------------------------------------------------
  // Auth API
  // ----------------------------------------------------------------------------
  auth = {
    login: async (credentials: LoginInput): Promise<LoginResponseData> => {
      const data = await this.request<LoginResponseData>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      this.setTokens(data.token, data.refreshToken);
      return data;
    },

    register: async (payload: RegisterInput): Promise<LoginResponseData> => {
      const data = await this.request<LoginResponseData>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      this.setTokens(data.token, data.refreshToken);
      return data;
    },

    refresh: async (refreshToken: string): Promise<{ token: string; refreshToken: string }> => {
      const data = await this.request<{ token: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      this.setTokens(data.token, data.refreshToken);
      return data;
    },

    changePassword: async (input: ChangePasswordInput): Promise<{ message: string }> => {
      return this.request<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    forgotPassword: async (input: ForgotPasswordInput): Promise<{ message: string; resetToken?: string }> => {
      return this.request<{ message: string; resetToken?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    resetPassword: async (input: ResetPasswordInput): Promise<{ message: string }> => {
      return this.request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    getMe: async (): Promise<UserDTO> => {
      return this.request<UserDTO>('/auth/me');
    },

    logout: async () => {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } catch (err) {
        console.warn('Logout notification failed:', err);
      } finally {
        this.setTokens(null, null);
      }
    },
  };

  // ----------------------------------------------------------------------------
  // User Administration API (RBAC)
  // ----------------------------------------------------------------------------
  users = {
    getAll: async (): Promise<UserDTO[]> => {
      return this.request<UserDTO[]>('/users');
    },

    create: async (input: CreateUserByAdminInput): Promise<UserDTO> => {
      return this.request<UserDTO>('/users', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    update: async (userId: string, input: Partial<CreateUserByAdminInput>): Promise<UserDTO> => {
      return this.request<UserDTO>(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },

    updateStatus: async (userId: string, input: UpdateUserStatusInput): Promise<UserDTO> => {
      return this.request<UserDTO>(`/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
  };

  // ----------------------------------------------------------------------------
  // Customers Directory API
  // ----------------------------------------------------------------------------
  customers = {
    getAll: async (filters?: {
      search?: string;
      kycStatus?: string;
      profileStatus?: string;
      page?: number;
      pageSize?: number;
    }): Promise<CustomerDTO[]> => {
      let endpoint = '/customers';
      if (filters) {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.kycStatus && filters.kycStatus !== 'ALL') params.append('kycStatus', filters.kycStatus);
        if (filters.profileStatus && filters.profileStatus !== 'ALL') params.append('profileStatus', filters.profileStatus);
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
        const qs = params.toString();
        if (qs) endpoint += `?${qs}`;
      }
      return this.request<CustomerDTO[]>(endpoint);
    },

    getById: async (id: string): Promise<CustomerDTO> => {
      return this.request<CustomerDTO>(`/customers/${id}`);
    },

    create: async (input: CreateCustomerInput): Promise<CustomerDTO> => {
      return this.request<CustomerDTO>('/customers', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    update: async (id: string, input: UpdateCustomerInput): Promise<CustomerDTO> => {
      return this.request<CustomerDTO>(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },

    delete: async (id: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`/customers/${id}`, {
        method: 'DELETE',
      });
    },

    updateStatus: async (id: string, input: UpdateCustomerStatusInput): Promise<CustomerDTO> => {
      return this.request<CustomerDTO>(`/customers/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },

    updateKycStatus: async (id: string, input: UpdateKycStatusInput): Promise<CustomerDTO> => {
      return this.request<CustomerDTO>(`/customers/${id}/kyc`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },

    addDocument: async (id: string, input: AddCustomerDocumentInput): Promise<CustomerDocumentDTO> => {
      return this.request<CustomerDocumentDTO>(`/customers/${id}/documents`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    verifyDocument: async (
      id: string,
      docId: string,
      input: VerifyCustomerDocumentInput
    ): Promise<CustomerDocumentDTO> => {
      return this.request<CustomerDocumentDTO>(`/customers/${id}/documents/${docId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },

    deleteDocument: async (id: string, docId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`/customers/${id}/documents/${docId}`, {
        method: 'DELETE',
      });
    },
  };

  // ----------------------------------------------------------------------------
  // Payments & Cashier Desk API
  // ----------------------------------------------------------------------------
  payments = {
    getAll: async (params?: { loanId?: string; customerId?: string; search?: string }): Promise<PaymentTransactionDTO[]> => {
      const query = new URLSearchParams();
      if (params?.loanId) query.set('loanId', params.loanId);
      if (params?.customerId) query.set('customerId', params.customerId);
      if (params?.search) query.set('search', params.search);
      const qs = query.toString() ? `?${query.toString()}` : '';
      return this.request<PaymentTransactionDTO[]>(`/payments${qs}`);
    },

    getById: async (id: string): Promise<PaymentTransactionDTO> => {
      return this.request<PaymentTransactionDTO>(`/payments/${id}`);
    },

    getReceipt: async (id: string): Promise<PaymentReceiptDTO> => {
      return this.request<PaymentReceiptDTO>(`/payments/${id}/receipt`);
    },

    previewAllocation: async (payload: {
      loanId: string;
      amount: number;
      strategy?: string;
      customPriority?: string[];
      overpaymentRule?: string;
      paymentDate?: string;
    }): Promise<any> => {
      return this.request<any>('/payments/preview-allocation', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    create: async (input: CreatePaymentInput): Promise<PaymentTransactionDTO> => {
      return this.request<PaymentTransactionDTO>('/payments', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    reverse: async (
      id: string,
      reason: string
    ): Promise<{ originalPayment: PaymentTransactionDTO; reversalTransaction: PaymentTransactionDTO }> => {
      return this.request<{ originalPayment: PaymentTransactionDTO; reversalTransaction: PaymentTransactionDTO }>(
        `/payments/${id}/reverse`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      );
    },
  };

  // ----------------------------------------------------------------------------
  // Reports & Analytics API
  // ----------------------------------------------------------------------------
  reports = {
    getDashboard: async (branchId?: string): Promise<DashboardSummaryDTO> => {
      const qs = branchId && branchId !== 'ALL' ? `?branchId=${encodeURIComponent(branchId)}` : '';
      return this.request<DashboardSummaryDTO>(`/reports/dashboard${qs}`);
    },

    getPortfolio: async (): Promise<any> => {
      return this.request<any>('/reports/portfolio');
    },

    getFilterOptions: async (): Promise<ReportFilterOptionsDTO> => {
      return this.request<ReportFilterOptionsDTO>('/reports/filter-options');
    },

    queryReport: async (filter: ReportFilterParams): Promise<ReportResponseDTO> => {
      return this.request<ReportResponseDTO>('/reports/query', {
        method: 'POST',
        body: JSON.stringify(filter),
      });
    },

    exportReport: async (
      filter: ReportFilterParams,
      format: 'csv' | 'pdf' | 'html' = 'csv'
    ): Promise<{ filename: string; contentType: string; content: string; csvContent?: string }> => {
      return this.request<{ filename: string; contentType: string; content: string; csvContent?: string }>(
        `/reports/export?format=${format}`,
        {
          method: 'POST',
          body: JSON.stringify({ ...filter, format }),
        }
      );
    },

    exportData: async (type: 'loans' | 'collections' | string): Promise<{ filename: string; csvContent: string }> => {
      return this.request<{ filename: string; csvContent: string }>(`/reports/export?type=${type}`);
    },

    export: async (type = 'loans'): Promise<{ filename: string; csvContent: string }> => {
      return this.request<{ filename: string; csvContent: string }>(`/reports/export?type=${type}`);
    },
  };

  // ----------------------------------------------------------------------------
  // System Configuration Settings API
  // ----------------------------------------------------------------------------
  settings = {
    getAll: async (): Promise<Array<{ key: string; value: string; description: string; group: string }>> => {
      return this.request<Array<{ key: string; value: string; description: string; group: string }>>('/settings');
    },

    update: async (input: BulkUpdateSettingsInput): Promise<Array<{ key: string; value: string; description: string; group: string }>> => {
      return this.request<Array<{ key: string; value: string; description: string; group: string }>>('/settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },

    getWorkflow: async (): Promise<WorkflowSettingsDTO> => {
      return this.request<WorkflowSettingsDTO>('/settings/workflow');
    },

    updateWorkflow: async (settings: WorkflowSettingsDTO): Promise<WorkflowSettingsDTO> => {
      return this.request<WorkflowSettingsDTO>('/settings/workflow', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },
  };

  // ----------------------------------------------------------------------------
  // Notifications & Channel Gateways API
  // ----------------------------------------------------------------------------
  notifications = {
    getAll: async (params?: {
      channel?: NotificationChannelType;
      unreadOnly?: boolean;
      search?: string;
      page?: number;
      pageSize?: number;
    }): Promise<{ notifications: NotificationDTO[]; total: number; unreadCount: number }> => {
      const query = new URLSearchParams();
      if (params?.channel) query.set('channel', params.channel);
      if (params?.unreadOnly !== undefined) query.set('unreadOnly', String(params.unreadOnly));
      if (params?.search) query.set('search', params.search);
      if (params?.page) query.set('page', String(params.page));
      if (params?.pageSize) query.set('pageSize', String(params.pageSize));
      const qs = query.toString() ? `?${query.toString()}` : '';
      return this.request<{ notifications: NotificationDTO[]; total: number; unreadCount: number }>(`/notifications${qs}`);
    },

    markAsRead: async (id: string): Promise<void> => {
      return this.request<void>(`/notifications/${id}/read`, { method: 'PUT' });
    },

    markAllAsRead: async (): Promise<{ count: number }> => {
      return this.request<{ count: number }>('/notifications/read-all', { method: 'PUT' });
    },

    delete: async (id: string): Promise<void> => {
      return this.request<void>(`/notifications/${id}`, { method: 'DELETE' });
    },

    getSettings: async (): Promise<NotificationSystemSettingsDTO> => {
      return this.request<NotificationSystemSettingsDTO>('/notifications/settings');
    },

    updateRule: async (eventType: NotificationEventType, updates: Partial<NotificationTypeRuleDTO>): Promise<NotificationTypeRuleDTO> => {
      return this.request<NotificationTypeRuleDTO>(`/notifications/rules/${eventType}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },

    updateTemplate: async (id: string, updates: { subjectTemplate?: string; bodyTemplate?: string; enabled?: boolean }): Promise<NotificationTemplateDTO> => {
      return this.request<NotificationTemplateDTO>(`/notifications/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },

    updateSmsConfig: async (config: Partial<SmsProviderConfigDTO>): Promise<SmsProviderConfigDTO> => {
      return this.request<SmsProviderConfigDTO>('/notifications/providers/sms', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
    },

    updateEmailConfig: async (config: Partial<EmailProviderConfigDTO>): Promise<EmailProviderConfigDTO> => {
      return this.request<EmailProviderConfigDTO>('/notifications/providers/email', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
    },

    updateGlobalChannels: async (channels: { inApp?: boolean; email?: boolean; sms?: boolean }): Promise<{ inApp: boolean; email: boolean; sms: boolean }> => {
      return this.request<{ inApp: boolean; email: boolean; sms: boolean }>('/notifications/channels/global', {
        method: 'PUT',
        body: JSON.stringify(channels),
      });
    },

    testDispatch: async (data: { eventType: NotificationEventType; channel: NotificationChannelType; recipient?: { phone?: string; email?: string } }): Promise<{ success: boolean; result: any }> => {
      return this.request<{ success: boolean; result: any }>('/notifications/test-dispatch', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    scanAlerts: async (): Promise<{ upcomingCount: number; overdueCount: number; totalDispatched: number }> => {
      return this.request<{ upcomingCount: number; overdueCount: number; totalDispatched: number }>('/notifications/scan-alerts', {
        method: 'POST',
      });
    },
  };

  // ----------------------------------------------------------------------------
  // Loan Applications Workflow API
  // ----------------------------------------------------------------------------
  applications = {
    getAll: async (params?: { customerId?: string; status?: string; search?: string }): Promise<LoanApplicationDTO[]> => {
      const query = new URLSearchParams();
      if (params?.customerId) query.set('customerId', params.customerId);
      if (params?.status) query.set('status', params.status);
      if (params?.search) query.set('search', params.search);
      const qs = query.toString() ? `?${query.toString()}` : '';
      return this.request<LoanApplicationDTO[]>(`/applications${qs}`);
    },

    getById: async (id: string): Promise<LoanApplicationDTO> => {
      return this.request<LoanApplicationDTO>(`/applications/${id}`);
    },

    create: async (input: CreateLoanApplicationInput): Promise<LoanApplicationDTO> => {
      return this.request<LoanApplicationDTO>('/applications', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    submit: async (id: string): Promise<LoanApplicationDTO> => {
      return this.request<LoanApplicationDTO>(`/applications/${id}/submit`, {
        method: 'POST',
      });
    },

    addDocument: async (
      id: string,
      doc: { documentType: string; documentName: string; fileSize?: string; fileUrl: string }
    ): Promise<ApplicationDocumentDTO> => {
      return this.request<ApplicationDocumentDTO>(`/applications/${id}/documents`, {
        method: 'POST',
        body: JSON.stringify(doc),
      });
    },

    addNote: async (id: string, note: AddApplicationNoteInput): Promise<ApplicationNoteDTO> => {
      return this.request<ApplicationNoteDTO>(`/applications/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify(note),
      });
    },

    recommend: async (id: string, input: RecommendApplicationInput): Promise<LoanApplicationDTO> => {
      return this.request<LoanApplicationDTO>(`/applications/${id}/recommend`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    assess: async (id: string, input: CreditAssessmentInput): Promise<CreditAssessmentDTO> => {
      return this.request<CreditAssessmentDTO>(`/applications/${id}/assess`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    transitionStatus: async (
      id: string,
      input: TransitionApplicationStatusInput
    ): Promise<LoanApplicationDTO> => {
      return this.request<LoanApplicationDTO>(`/applications/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },

    disburse: async (
      id: string,
      input: DisburseLoanInput
    ): Promise<{ application: LoanApplicationDTO; loan: LoanDTO; disbursement: LoanDisbursementDTO }> => {
      return this.request<{ application: LoanApplicationDTO; loan: LoanDTO; disbursement: LoanDisbursementDTO }>(
        `/applications/${id}/disburse`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
    },

    getCustomerHistory: async (id: string): Promise<CustomerLoanSummaryDTO> => {
      return this.request<CustomerLoanSummaryDTO>(`/applications/${id}/customer-history`);
    },

    getStats: async (): Promise<any> => {
      return this.request<any>('/applications/stats');
    },
  };

  // ----------------------------------------------------------------------------
  // Loans & Products API
  // ----------------------------------------------------------------------------
  loans = {
    getAll: async (params?: { borrowerId?: string; status?: string }): Promise<LoanDTO[]> => {
      const query = new URLSearchParams();
      if (params?.borrowerId) query.set('borrowerId', params.borrowerId);
      if (params?.status) query.set('status', params.status);
      const qs = query.toString() ? `?${query.toString()}` : '';
      return this.request<LoanDTO[]>(`/loans${qs}`);
    },

    getById: async (loanId: string): Promise<LoanDTO> => {
      return this.request<LoanDTO>(`/loans/${loanId}`);
    },

    getCustomerSummary: async (customerId: string): Promise<CustomerLoanSummaryDTO> => {
      return this.request<CustomerLoanSummaryDTO>(`/loans/customer/${customerId}/summary`);
    },

    apply: async (application: CreateLoanApplicationInput): Promise<LoanDTO> => {
      return this.request<LoanDTO>('/loans/apply', {
        method: 'POST',
        body: JSON.stringify(application),
      });
    },

    disburse: async (
      loanId: string,
      input: DisburseLoanInput
    ): Promise<{ loan: LoanDTO; disbursement: LoanDisbursementDTO }> => {
      return this.request<{ loan: LoanDTO; disbursement: LoanDisbursementDTO }>(
        `/loans/${loanId}/disburse`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
    },

    updateStatus: async (loanId: string, payload: UpdateLoanStatusInput): Promise<LoanDTO> => {
      return this.request<LoanDTO>(`/loans/${loanId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },

    recordPayment: async (loanId: string, payload: RecordPaymentInput): Promise<LoanDTO> => {
      return this.request<LoanDTO>(`/loans/${loanId}/payments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getStats: async (): Promise<LoanPortfolioStatsDTO> => {
      return this.request<LoanPortfolioStatsDTO>('/loans/stats');
    },

    getProducts: async (): Promise<LoanProductDTO[]> => {
      return this.request<LoanProductDTO[]>('/products');
    },
  };

  // ----------------------------------------------------------------------------
  // Loan Products Management & Calculation API
  // ----------------------------------------------------------------------------
  products = {
    getAll: async (includeInactive = true): Promise<LoanProductDTO[]> => {
      return this.request<LoanProductDTO[]>(`/products?includeInactive=${includeInactive}`);
    },

    getById: async (id: string): Promise<LoanProductDTO> => {
      return this.request<LoanProductDTO>(`/products/${id}`);
    },

    create: async (input: CreateLoanProductInput): Promise<LoanProductDTO> => {
      return this.request<LoanProductDTO>('/products', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    update: async (id: string, input: UpdateLoanProductInput): Promise<LoanProductDTO> => {
      return this.request<LoanProductDTO>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },

    toggleStatus: async (id: string, status: string): Promise<LoanProductDTO> => {
      return this.request<LoanProductDTO>(`/products/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    delete: async (id: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`/products/${id}`, {
        method: 'DELETE',
      });
    },

    calculate: async (input: CalculateLoanInput): Promise<LoanCalculationResultDTO> => {
      return this.request<LoanCalculationResultDTO>('/products/calculate', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
  };

  // ----------------------------------------------------------------------------
  // Audit Logs API
  // ----------------------------------------------------------------------------
  audit = {
    getLogs: async (limit = 50): Promise<AuditLogDTO[]> => {
      return this.request<AuditLogDTO[]>(`/audit-logs?limit=${limit}`);
    },
  };

  // ----------------------------------------------------------------------------
  // Health & System API
  // ----------------------------------------------------------------------------
  health = {
    check: async (): Promise<SystemHealthDTO> => {
      return this.request<SystemHealthDTO>('/health');
    },
  };
}

export const api = new ApiClient();
