export type AuthField = "email" | "password" | "full_name" | "confirm_password";
export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export function validateLogin(email: string, password: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const normalized = email.trim();
  if (!normalized || normalized.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    errors.email = "Vui lòng nhập địa chỉ email hợp lệ.";
  }
  if (!password) errors.password = "Vui lòng nhập mật khẩu.";
  return errors;
}

export function validateRegistration(
  fullName: string,
  email: string,
  password: string,
  confirmation: string,
): AuthFieldErrors {
  const errors = validateLogin(email, password);
  if (!fullName.trim() || fullName.trim().length > 150) {
    errors.full_name = "Họ và tên phải có từ 1 đến 150 ký tự.";
  }
  const passwordLength = [...password].length;
  if (passwordLength < 15 || passwordLength > 128) {
    errors.password = "Mật khẩu phải có từ 15 đến 128 ký tự.";
  }
  if (password !== confirmation) errors.confirm_password = "Mật khẩu xác nhận chưa khớp.";
  return errors;
}
