/**
 * 個人情報マスキングユーティリティ
 * 電話番号やメールアドレスなどの個人情報を匿名化する共通機能
 */

export class MaskingUtil {
  /**
   * 電話番号を脱敏処理
   * @param phone 電話番号
   * @returns 脱敏後の電話番号
   */
  static maskPhoneNumber(phone: string): string {
    if (!phone) return '';
    
    // 移除所有非数字字符
    const cleaned = phone.replace(/\D/g, '');
    
    // 中国大陆手机号（11 位）：显示前 3 位和后 4 位
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return cleaned.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
    
    // 其他长度：显示前 3 位和后 2 位
    if (cleaned.length >= 7) {
      return cleaned.replace(/(\d{3})\d+(\d{2})/, '$1***$2');
    }
    
    // 太短的号码直接返回
    return phone;
  }

  /**
   * 邮箱地址脱敏处理
   * @param email 邮箱地址
   * @returns 脱敏后的邮箱地址
   */
  static maskEmail(email: string | null): string | null {
    if (!email) return null;
    
    const parts = email.split('@');
    if (parts.length !== 2) {
      return email;
    }
    
    const [username, domain] = parts;
    
    // ユーザー名の匿名化（最初の 2 文字のみ表示）
    let maskedUsername: string;
    if (username.length <= 2) {
      maskedUsername = username;
    } else if (username.length <= 5) {
      maskedUsername = username.substring(0, 2) + '*'.repeat(username.length - 2);
    } else {
      maskedUsername = username.substring(0, 3) + '*'.repeat(username.length - 3);
    }
    
    // ドメインの匿名化（先頭のみ表示）
    const maskedDomain = domain.charAt(0) + '*'.repeat(domain.length - 1);
    
    return `${maskedUsername}@${maskedDomain}`;
  }
}
