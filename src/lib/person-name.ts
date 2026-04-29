export function buildFullName(firstName?: string | null, lastName?: string | null) {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();
}

export function splitFullName(fullName: string) {
  const normalizedFullName = fullName.trim().replace(/\s+/g, " ");
  const [firstName, ...lastNameParts] = normalizedFullName.split(" ");

  return {
    normalizedFullName,
    firstName: firstName || normalizedFullName,
    lastName: lastNameParts.join(" ") || null,
  };
}



