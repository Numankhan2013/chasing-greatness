#!/usr/bin/env bash
# One-time setup, run in Google Cloud Shell as the project owner. It lets GitHub Actions deploy
# to Firebase with no stored secrets (Workload Identity Federation), and creates the Hosting site.
set -u
PROJECT=chasing-greatness
NUM=403315725957
REPO=Numankhan2013/chasing-greatness
SA=github-deployer@$PROJECT.iam.gserviceaccount.com
gcloud config set project $PROJECT -q
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com firebase.googleapis.com firebasehosting.googleapis.com firebaserules.googleapis.com -q
gcloud iam service-accounts describe $SA >/dev/null 2>&1 || gcloud iam service-accounts create github-deployer --display-name="GitHub deployer" -q
sleep 5
for r in roles/firebase.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$SA --role=$r --condition=None -q >/dev/null && echo "granted $r"
done
gcloud iam workload-identity-pools describe github --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create github --location=global --display-name=GitHub -q
gcloud iam workload-identity-pools providers describe github --location=global --workload-identity-pool=github >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github \
    --display-name="GitHub Actions" --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='$REPO'" -q
gcloud iam service-accounts add-iam-policy-binding $SA --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$NUM/locations/global/workloadIdentityPools/github/attribute.repository/$REPO" -q >/dev/null && echo "bound workload identity"
curl -s -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT" "https://firebasehosting.googleapis.com/v1beta1/projects/$PROJECT/sites?siteId=$PROJECT" -d '{}' | head -c 300; echo
echo "CG_SETUP_DONE"
