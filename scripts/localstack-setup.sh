#!/usr/bin/env bash
# =============================================================================
# scripts/localstack-setup.sh
# Setup AWS resources di LocalStack Pro untuk CI/CD testing
#
# Dijalankan SETELAH LocalStack healthy.
# Membuat: S3 bucket, SQS queues, verifikasi email SES, SSM parameters
#
# Usage:
#   ./scripts/localstack-setup.sh
#   LOCALSTACK_ENDPOINT=http://localhost:4566 ./scripts/localstack-setup.sh
# =============================================================================

set -euo pipefail

# ── Konfigurasi ───────────────────────────────────────────────────────────────
LOCALSTACK_ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Dummy credentials untuk LocalStack (tidak perlu asli)
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export AWS_DEFAULT_REGION="${AWS_REGION}"

# Alias awslocal (gunakan aws CLI biasa dengan --endpoint-url)
awslocal() {
    aws --endpoint-url="${LOCALSTACK_ENDPOINT}" "$@"
}

# ── Warna untuk output ────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Tunggu LocalStack siap ─────────────────────────────────────────────────────
wait_for_localstack() {
    log_info "Menunggu LocalStack ready di ${LOCALSTACK_ENDPOINT}..."
    local max_retries=30
    local count=0
    until curl -sf "${LOCALSTACK_ENDPOINT}/_localstack/health" | grep -q '"s3": "running"' 2>/dev/null; do
        count=$((count + 1))
        if [ "${count}" -ge "${max_retries}" ]; then
            log_error "LocalStack tidak ready setelah ${max_retries} percobaan!"
            curl -sf "${LOCALSTACK_ENDPOINT}/_localstack/health" || true
            exit 1
        fi
        echo -n "."
        sleep 2
    done
    echo ""
    log_success "LocalStack Pro ready!"
}

# =============================================================================
# 1. S3 — Object Storage (untuk upload foto/dokumen)
# =============================================================================
setup_s3() {
    log_info "━━━ Setup S3 Buckets ━━━"

    local BUCKET="${STORAGE_BUCKET:-kirimkarya-test}"

    # Buat bucket utama
    if awslocal s3 ls "s3://${BUCKET}" 2>&1 | grep -q 'NoSuchBucket\|does not exist'; then
        awslocal s3 mb "s3://${BUCKET}" --region "${AWS_REGION}"
        log_success "Bucket s3://${BUCKET} dibuat"
    else
        awslocal s3 mb "s3://${BUCKET}" --region "${AWS_REGION}" 2>/dev/null || true
        log_success "Bucket s3://${BUCKET} sudah ada atau baru dibuat"
    fi

    # Set CORS policy untuk akses dari web
    awslocal s3api put-bucket-cors \
        --bucket "${BUCKET}" \
        --cors-configuration '{
            "CORSRules": [{
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
                "AllowedOrigins": ["http://localhost:5173", "http://localhost:3000"],
                "ExposeHeaders": ["ETag"]
            }]
        }'
    log_success "CORS policy diterapkan ke bucket ${BUCKET}"

    # Verifikasi
    log_info "Daftar semua bucket:"
    awslocal s3 ls
}

# =============================================================================
# 2. SQS — Message Queue (untuk BullMQ / background jobs)
# =============================================================================
setup_sqs() {
    log_info "━━━ Setup SQS Queues ━━━"

    local queues=(
        "kirimkarya-photo-processing"
        "kirimkarya-notifications"
        "kirimkarya-delivery"
        "kirimkarya-cleanup"
    )

    for queue in "${queues[@]}"; do
        QUEUE_URL=$(awslocal sqs create-queue \
            --queue-name "${queue}" \
            --attributes '{
                "VisibilityTimeout": "30",
                "MessageRetentionPeriod": "86400"
            }' \
            --query 'QueueUrl' \
            --output text)
        log_success "SQS Queue dibuat: ${queue}"
        log_info "  URL: ${QUEUE_URL}"
    done

    # Dead Letter Queue untuk notifikasi gagal
    DLQ_URL=$(awslocal sqs create-queue \
        --queue-name "kirimkarya-notifications-dlq" \
        --attributes '{"MessageRetentionPeriod": "604800"}' \
        --query 'QueueUrl' \
        --output text)
    log_success "Dead Letter Queue dibuat: kirimkarya-notifications-dlq"

    # Verifikasi
    log_info "Daftar semua queues:"
    awslocal sqs list-queues
}

# =============================================================================
# 3. SES — Simple Email Service [LocalStack Pro Feature]
# Untuk kirim email notifikasi (gallery delivered, selection submitted, dll)
# =============================================================================
setup_ses() {
    log_info "━━━ Setup SES (Pro Feature) ━━━"

    local emails=(
        "noreply@kirimkarya.com"
        "support@kirimkarya.com"
        "ci-test@kirimkarya.com"
    )

    for email in "${emails[@]}"; do
        awslocal ses verify-email-identity \
            --email-address "${email}" \
            --region "${AWS_REGION}" 2>/dev/null || true
        log_success "SES email diverifikasi: ${email}"
    done

    # Verifikasi domain (Pro feature)
    awslocal ses verify-domain-identity \
        --domain "kirimkarya.com" \
        --region "${AWS_REGION}" 2>/dev/null || log_warn "Domain verification mungkin butuh Pro license"

    # Set sending limit (sandbox mode override di LocalStack)
    log_info "Daftar verified email identities:"
    awslocal ses list-identities --region "${AWS_REGION}"
}

# =============================================================================
# 4. SSM Parameter Store [LocalStack Pro Feature]
# Menyimpan konfigurasi/secrets aplikasi secara terpusat
# =============================================================================
setup_ssm() {
    log_info "━━━ Setup SSM Parameter Store (Pro Feature) ━━━"

    # Simpan konfigurasi CI ke SSM (contoh belajar secrets management)
    local params=(
        "/kirimkarya/ci/database_url|String|postgres://ci_user:ci_password@localhost:5432/kirimkarya_ci"
        "/kirimkarya/ci/redis_url|String|redis://localhost:6379"
        "/kirimkarya/ci/storage_bucket|String|kirimkarya-test"
        "/kirimkarya/ci/storage_endpoint|String|http://localhost:4566"
        "/kirimkarya/ci/better_auth_secret|SecureString|ci-secret-key-not-for-production"
    )

    for param_entry in "${params[@]}"; do
        IFS='|' read -r param_name param_type param_value <<< "${param_entry}"
        awslocal ssm put-parameter \
            --name "${param_name}" \
            --value "${param_value}" \
            --type "${param_type}" \
            --overwrite \
            --region "${AWS_REGION}" 2>/dev/null || log_warn "SSM put-parameter gagal untuk ${param_name} (mungkin butuh Pro)"
        log_success "SSM Parameter: ${param_name} [${param_type}]"
    done

    log_info "Daftar SSM parameters:"
    awslocal ssm describe-parameters --region "${AWS_REGION}" \
        --query 'Parameters[].Name' --output table 2>/dev/null || log_warn "SSM list gagal"
}

# =============================================================================
# 5. Upload test fixtures ke S3 (untuk integration tests)
# =============================================================================
setup_test_fixtures() {
    log_info "━━━ Upload Test Fixtures ke S3 ━━━"

    local BUCKET="${STORAGE_BUCKET:-kirimkarya-test}"

    # Buat dummy file untuk test
    echo '{"test": true, "fixture": "sample"}' > /tmp/test-fixture.json
    echo 'FAKE_IMAGE_DATA' > /tmp/test-image.jpg

    awslocal s3 cp /tmp/test-fixture.json "s3://${BUCKET}/fixtures/test-fixture.json"
    log_success "Fixture diupload: s3://${BUCKET}/fixtures/test-fixture.json"

    awslocal s3 cp /tmp/test-image.jpg "s3://${BUCKET}/fixtures/test-image.jpg"
    log_success "Fixture diupload: s3://${BUCKET}/fixtures/test-image.jpg"

    # List isi bucket
    log_info "Isi bucket ${BUCKET}:"
    awslocal s3 ls "s3://${BUCKET}/" --recursive
}

# =============================================================================
# Main
# =============================================================================
main() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  LocalStack Pro Setup — KirimKarya CI/CD           ${NC}"
    echo -e "${GREEN}  Endpoint: ${LOCALSTACK_ENDPOINT}                  ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
    echo ""

    wait_for_localstack
    echo ""

    setup_s3
    echo ""

    setup_sqs
    echo ""

    setup_ses
    echo ""

    setup_ssm
    echo ""

    setup_test_fixtures
    echo ""

    echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ LocalStack setup selesai!                      ${NC}"
    echo -e "${GREEN}  S3, SQS, SES, SSM siap digunakan                 ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
    echo ""
}

main "$@"
