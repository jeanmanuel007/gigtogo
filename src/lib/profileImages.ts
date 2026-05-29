const defaultProfileImage = "/GigToGo_logo.svg";
const defaultCoverImage = "/business-default-1.jpg";

export function getProfileImage(uploadedImage = "") {
  return uploadedImage || defaultProfileImage;
}

export function getCoverImage() {
  return defaultCoverImage;
}
