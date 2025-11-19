"use client"

import { useEffect, useMemo, useState } from "react"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Loader2, Users, Plus, ArrowRight, Check, RefreshCw, ListFilter, Sparkles, Edit, Save, ChevronDown, ChevronUp, Upload, Image as ImageIcon, Video, File, X, ExternalLink, Trash2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { TreatmentsService } from "@/lib/treatments-service"
import { TreatmentScenesService, type TreatmentScene } from "@/lib/treatment-scenes-service"
import { ScreenplayScenesService, type ScreenplayScene } from "@/lib/screenplay-scenes-service"
import { CastingService, type CastingSetting } from "@/lib/casting-service"
import { CharactersService, type Character } from "@/lib/characters-service"
import { OpenAIService } from "@/lib/ai-services"
import { AISettingsService } from "@/lib/ai-settings-service"
import { getSupabaseClient } from "@/lib/supabase"
import { AssetService, type Asset } from "@/lib/asset-service"

export default function CharactersPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  const [treatmentId, setTreatmentId] = useState<string | null>(null)
  const [treatmentScenes, setTreatmentScenes] = useState<TreatmentScene[]>([])
  const [screenplayScenes, setScreenplayScenes] = useState<ScreenplayScene[]>([])
  const [castingSettings, setCastingSettings] = useState<CastingSetting | null>(null)
  const [filter, setFilter] = useState<string>("")
  const [newCharacter, setNewCharacter] = useState<string>("")
  const [syncing, setSyncing] = useState(false)
  // Characters data
  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false)
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false)
  const [newCharName, setNewCharName] = useState("")
  const [newCharArchetype, setNewCharArchetype] = useState("")
  const [newCharDescription, setNewCharDescription] = useState("")
  const [newCharBackstory, setNewCharBackstory] = useState("")
  const [newCharGoals, setNewCharGoals] = useState("")
  const [newCharConflicts, setNewCharConflicts] = useState("")
  const [newCharPersonalityTraits, setNewCharPersonalityTraits] = useState("")
  const [isGeneratingFromTreatment, setIsGeneratingFromTreatment] = useState(false)
  const [generatingSection, setGeneratingSection] = useState<string | null>(null)
  
  // Character Sheet Fields - Core Identity
  const [newCharFullName, setNewCharFullName] = useState("")
  const [newCharNicknames, setNewCharNicknames] = useState("")
  const [newCharBirthdate, setNewCharBirthdate] = useState("")
  const [newCharNationality, setNewCharNationality] = useState("")
  const [newCharEthnicity, setNewCharEthnicity] = useState("")
  const [newCharPlaceOfBirth, setNewCharPlaceOfBirth] = useState("")
  const [newCharCurrentResidence, setNewCharCurrentResidence] = useState("")
  const [newCharOccupation, setNewCharOccupation] = useState("")
  const [newCharEducationLevel, setNewCharEducationLevel] = useState("")
  const [newCharSocioEconomicPast, setNewCharSocioEconomicPast] = useState("")
  const [newCharSocioEconomicPresent, setNewCharSocioEconomicPresent] = useState("")
  const [newCharLanguages, setNewCharLanguages] = useState("") // comma-separated
  
  // Visual Bible
  const [newCharHeight, setNewCharHeight] = useState("")
  const [newCharBuild, setNewCharBuild] = useState("")
  const [newCharSkinTone, setNewCharSkinTone] = useState("")
  const [newCharEyeColor, setNewCharEyeColor] = useState("")
  const [newCharEyeShape, setNewCharEyeShape] = useState("")
  const [newCharEyeExpression, setNewCharEyeExpression] = useState("")
  const [newCharHairColorNatural, setNewCharHairColorNatural] = useState("")
  const [newCharHairColorCurrent, setNewCharHairColorCurrent] = useState("")
  const [newCharHairLength, setNewCharHairLength] = useState("")
  const [newCharHairTexture, setNewCharHairTexture] = useState("")
  const [newCharUsualHairstyle, setNewCharUsualHairstyle] = useState("")
  const [newCharFaceShape, setNewCharFaceShape] = useState("")
  const [newCharDistinguishingMarks, setNewCharDistinguishingMarks] = useState("")
  const [newCharUsualClothingStyle, setNewCharUsualClothingStyle] = useState("")
  const [newCharTypicalColorPalette, setNewCharTypicalColorPalette] = useState("")
  const [newCharAccessories, setNewCharAccessories] = useState("")
  const [newCharPosture, setNewCharPosture] = useState("")
  const [newCharBodyLanguage, setNewCharBodyLanguage] = useState("")
  const [newCharVoicePitch, setNewCharVoicePitch] = useState("")
  const [newCharVoiceSpeed, setNewCharVoiceSpeed] = useState("")
  const [newCharVoiceAccent, setNewCharVoiceAccent] = useState("")
  const [newCharVoiceTone, setNewCharVoiceTone] = useState("")
  const [newCharReferenceImages, setNewCharReferenceImages] = useState("")
  
  // Psychology
  const [newCharCoreValues, setNewCharCoreValues] = useState("")
  const [newCharMainExternalGoal, setNewCharMainExternalGoal] = useState("")
  const [newCharDeepInternalNeed, setNewCharDeepInternalNeed] = useState("")
  const [newCharGreatestFear, setNewCharGreatestFear] = useState("")
  const [newCharFatalFlaw, setNewCharFatalFlaw] = useState("")
  const [newCharKeyStrengths, setNewCharKeyStrengths] = useState("")
  const [newCharCopingStyleStress, setNewCharCopingStyleStress] = useState("")
  const [newCharBaselinePersonality, setNewCharBaselinePersonality] = useState("")
  const [newCharSenseOfHumor, setNewCharSenseOfHumor] = useState("")
  const [newCharTreatsAuthority, setNewCharTreatsAuthority] = useState("")
  const [newCharTreatsSubordinates, setNewCharTreatsSubordinates] = useState("")
  const [newCharTreatsLovedOnes, setNewCharTreatsLovedOnes] = useState("")
  
  // Backstory & Timeline
  const [newCharChildhoodSituation, setNewCharChildhoodSituation] = useState("")
  const [newCharImportantChildhoodEvent1, setNewCharImportantChildhoodEvent1] = useState("")
  const [newCharImportantTeenEvent, setNewCharImportantTeenEvent] = useState("")
  const [newCharImportantAdulthoodEvent, setNewCharImportantAdulthoodEvent] = useState("")
  const [newCharMajorTraumaOrLoss, setNewCharMajorTraumaOrLoss] = useState("")
  const [newCharBiggestVictoryOrSuccess, setNewCharBiggestVictoryOrSuccess] = useState("")
  const [newCharWhatChangedBeforeStory, setNewCharWhatChangedBeforeStory] = useState("")
  const [newCharPersonalSecrets, setNewCharPersonalSecrets] = useState("")
  const [newCharTruthHiddenFromSelf, setNewCharTruthHiddenFromSelf] = useState("")
  
  // Relationships
  const [newCharParentsInfo, setNewCharParentsInfo] = useState("")
  const [newCharSiblingsInfo, setNewCharSiblingsInfo] = useState("")
  const [newCharOtherFamilyInfo, setNewCharOtherFamilyInfo] = useState("")
  const [newCharBestFriends, setNewCharBestFriends] = useState("")
  const [newCharOtherFriendsAllies, setNewCharOtherFriendsAllies] = useState("")
  const [newCharRomanticStatus, setNewCharRomanticStatus] = useState("")
  const [newCharImportantExes, setNewCharImportantExes] = useState("")
  const [newCharEnemiesRivals, setNewCharEnemiesRivals] = useState("")
  const [newCharMentors, setNewCharMentors] = useState("")
  const [newCharPeopleResponsibleFor, setNewCharPeopleResponsibleFor] = useState("")
  
  // Story Role & Arc
  const [newCharRoleInStory, setNewCharRoleInStory] = useState("")
  const [newCharCharacterLogline, setNewCharCharacterLogline] = useState("")
  const [newCharStartingState, setNewCharStartingState] = useState("")
  const [newCharMidpointChange, setNewCharMidpointChange] = useState("")
  const [newCharEndState, setNewCharEndState] = useState("")
  const [newCharKeyDecisions, setNewCharKeyDecisions] = useState("")
  
  // Practical Details
  const [newCharVehicleType, setNewCharVehicleType] = useState("")
  const [newCharVehicleModel, setNewCharVehicleModel] = useState("")
  const [newCharVehicleColor, setNewCharVehicleColor] = useState("")
  const [newCharVehicleCondition, setNewCharVehicleCondition] = useState("")
  const [newCharPhoneTechLevel, setNewCharPhoneTechLevel] = useState("")
  const [newCharHomeType, setNewCharHomeType] = useState("")
  const [newCharHomeNeighborhood, setNewCharHomeNeighborhood] = useState("")
  const [newCharHomeCondition, setNewCharHomeCondition] = useState("")
  const [newCharHomeKeyObjects, setNewCharHomeKeyObjects] = useState("")
  const [newCharDailyRoutine, setNewCharDailyRoutine] = useState("")
  const [newCharJobSchedule, setNewCharJobSchedule] = useState("")
  const [newCharPets, setNewCharPets] = useState("")
  const [newCharHobbies, setNewCharHobbies] = useState("")
  const [newCharAddictionsHabits, setNewCharAddictionsHabits] = useState("")
  const [newCharHealthIssues, setNewCharHealthIssues] = useState("")
  const [newCharReligionSpirituality, setNewCharReligionSpirituality] = useState("")
  const [newCharPoliticalSocialViews, setNewCharPoliticalSocialViews] = useState("")
  
  // Dialogue Notes
  const [newCharCommonPhrases, setNewCharCommonPhrases] = useState("")
  const [newCharSwearingLevel, setNewCharSwearingLevel] = useState("")
  const [newCharSpeakingStyle, setNewCharSpeakingStyle] = useState("")
  const [newCharLanguageSwitches, setNewCharLanguageSwitches] = useState("")
  
  // Extra Notes
  const [newCharVisualMotifs, setNewCharVisualMotifs] = useState("")
  const [newCharThemeTheyRepresent, setNewCharThemeTheyRepresent] = useState("")
  const [newCharForeshadowingNotes, setNewCharForeshadowingNotes] = useState("")
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null)
  const [editingCharacterInFormId, setEditingCharacterInFormId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editArchetype, setEditArchetype] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editBackstory, setEditBackstory] = useState("")
  const [editGoals, setEditGoals] = useState("")
  const [editConflicts, setEditConflicts] = useState("")
  const [editTraits, setEditTraits] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [characterAssets, setCharacterAssets] = useState<Asset[]>([])
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        // Find treatment for project (if any)
        const treatment = await TreatmentsService.getTreatmentByProjectId(projectId)
        setTreatmentId(treatment?.id || null)

        // Load scenes from treatment (if present) and screenplay scenes
        const [tScenes, sScenes] = await Promise.all([
          treatment?.id ? TreatmentScenesService.getTreatmentScenes(treatment.id) : Promise.resolve([]),
          ScreenplayScenesService.getScreenplayScenes(projectId),
        ])
        setTreatmentScenes(tScenes)
        setScreenplayScenes(sScenes)

        // Load casting settings for roles_available
        const settings = await CastingService.getCastingSettings(projectId)
        setCastingSettings(settings)

        // Load existing characters
        setIsLoadingCharacters(true)
        const chars = await CharactersService.getCharacters(projectId)
        setCharacters(chars)
      } catch (err) {
        console.error("Failed to load characters data:", err)
        toast({
          title: "Error",
          description: "Failed to load characters. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingCharacters(false)
        setLoading(false)
      }
    }
    load()
  }, [projectId, toast])

  // Auto-select first character when characters are loaded
  useEffect(() => {
    if (characters.length > 0 && !selectedCharacterId) {
      setSelectedCharacterId(characters[0].id)
    }
  }, [characters, selectedCharacterId])

  // Load assets when a character is selected
  useEffect(() => {
    const loadAssets = async () => {
      if (!selectedCharacterId) {
        setCharacterAssets([])
        return
      }
      try {
        setIsLoadingAssets(true)
        const assets = await AssetService.getAssetsForCharacter(selectedCharacterId)
        setCharacterAssets(assets)
      } catch (err) {
        console.error('Failed to load character assets:', err)
        setCharacterAssets([])
        // Show toast only for non-migration errors (migration errors are already handled)
        if (err instanceof Error && !err.message.includes('migration')) {
          toast({
            title: "Error",
            description: "Failed to load character assets.",
            variant: "destructive",
          })
        }
      } finally {
        setIsLoadingAssets(false)
      }
    }
    loadAssets()
  }, [selectedCharacterId, toast])

  // Aggregate distinct characters from all scenes
  const detectedCharacters = useMemo(() => {
    const set = new Set<string>()
    const counts = new Map<string, number>()

    const addNames = (names?: string[]) => {
      if (!names) return
      names.forEach((n) => {
        const name = (n || "").trim()
        if (!name) return
        set.add(name)
        counts.set(name, (counts.get(name) || 0) + 1)
      })
    }

    treatmentScenes.forEach((s) => addNames(s.characters))
    screenplayScenes.forEach((s) => addNames(s.characters))

    const list = Array.from(set.values()).map((name) => ({
      name,
      count: counts.get(name) || 0,
    }))

    // Optional filter
    return list
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .filter((c) => (filter ? c.name.toLowerCase().includes(filter.toLowerCase()) : true))
  }, [treatmentScenes, screenplayScenes, filter])

  const rolesAvailable = useMemo(() => {
    const roles = castingSettings?.roles_available || []
    return roles
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .filter((r) => (filter ? r.toLowerCase().includes(filter.toLowerCase()) : true))
  }, [castingSettings, filter])

  const missingInRoles = useMemo(() => {
    const roles = new Set((castingSettings?.roles_available || []).map((r) => r.toLowerCase()))
    return detectedCharacters
      .filter((c) => !roles.has(c.name.toLowerCase()))
      .map((c) => c.name)
  }, [detectedCharacters, castingSettings])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setSelectedCharacterId(null) // Clear selection when project changes
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("movie", id)
    } else {
      url.searchParams.delete("movie")
    }
    router.replace(url.toString())
  }

  const beginEdit = (ch: Character) => {
    setEditingCharacterId(ch.id)
    setEditName(ch.name || "")
    setEditArchetype(ch.archetype || "")
    setEditDescription(ch.description || "")
    setEditBackstory(ch.backstory || "")
    setEditGoals(ch.goals || "")
    setEditConflicts(ch.conflicts || "")
    const traits = (ch.personality as any)?.traits as string[] | undefined
    setEditTraits(traits && Array.isArray(traits) ? traits.join(", ") : "")
  }

  const cancelEdit = () => {
    setEditingCharacterId(null)
    setIsSavingEdit(false)
  }

  const loadCharacterIntoForm = (ch: Character) => {
    // Select the character in the View Character dropdown
    setSelectedCharacterId(ch.id)
    // Load into form for editing
    setEditingCharacterInFormId(ch.id)
    setNewCharName(ch.name || "")
    setNewCharArchetype(ch.archetype || "")
    setNewCharDescription(ch.description || "")
    setNewCharBackstory(ch.backstory || "")
    setNewCharGoals(ch.goals || "")
    setNewCharConflicts(ch.conflicts || "")
    const traits = (ch.personality as any)?.traits as string[] | undefined
    setNewCharPersonalityTraits(traits && Array.isArray(traits) ? traits.join(", ") : "")
    
    // Core Identity
    setNewCharFullName(ch.full_name || "")
    setNewCharNicknames((ch.nicknames || []).join(", ") || "")
    setNewCharBirthdate(ch.birthdate || "")
    setNewCharNationality(ch.nationality || "")
    setNewCharEthnicity(ch.ethnicity || "")
    setNewCharPlaceOfBirth(ch.place_of_birth || "")
    setNewCharCurrentResidence(ch.current_residence || "")
    setNewCharOccupation(ch.occupation || "")
    setNewCharEducationLevel(ch.education_level || "")
    setNewCharSocioEconomicPast(ch.socio_economic_status_past || "")
    setNewCharSocioEconomicPresent(ch.socio_economic_status_present || "")
    setNewCharLanguages((ch.languages_spoken || []).map((l: any) => `${l.language} (${l.fluency})`).join(", ") || "")
    
    // Visual Bible
    setNewCharHeight(ch.height || "")
    setNewCharBuild(ch.build || "")
    setNewCharSkinTone(ch.skin_tone || "")
    setNewCharEyeColor(ch.eye_color || "")
    setNewCharEyeShape(ch.eye_shape || "")
    setNewCharEyeExpression(ch.eye_expression || "")
    setNewCharHairColorNatural(ch.hair_color_natural || "")
    setNewCharHairColorCurrent(ch.hair_color_current || "")
    setNewCharHairLength(ch.hair_length || "")
    setNewCharHairTexture(ch.hair_texture || "")
    setNewCharUsualHairstyle(ch.usual_hairstyle || "")
    setNewCharFaceShape(ch.face_shape || "")
    setNewCharDistinguishingMarks(ch.distinguishing_marks || "")
    setNewCharUsualClothingStyle(ch.usual_clothing_style || "")
    setNewCharTypicalColorPalette((ch.typical_color_palette || []).join(", ") || "")
    setNewCharAccessories(ch.accessories || "")
    setNewCharPosture(ch.posture || "")
    setNewCharBodyLanguage(ch.body_language || "")
    setNewCharVoicePitch(ch.voice_pitch || "")
    setNewCharVoiceSpeed(ch.voice_speed || "")
    setNewCharVoiceAccent(ch.voice_accent || "")
    setNewCharVoiceTone(ch.voice_tone || "")
    setNewCharReferenceImages((ch.reference_images || []).join(", ") || "")
    
    // Psychology
    setNewCharCoreValues((ch.core_values || []).join(", ") || "")
    setNewCharMainExternalGoal(ch.main_external_goal || "")
    setNewCharDeepInternalNeed(ch.deep_internal_need || "")
    setNewCharGreatestFear(ch.greatest_fear || "")
    setNewCharFatalFlaw(ch.fatal_flaw || "")
    setNewCharKeyStrengths((ch.key_strengths || []).join(", ") || "")
    setNewCharCopingStyleStress(ch.coping_style_stress || "")
    setNewCharBaselinePersonality(ch.baseline_personality || "")
    setNewCharSenseOfHumor(ch.sense_of_humor || "")
    setNewCharTreatsAuthority(ch.treats_authority || "")
    setNewCharTreatsSubordinates(ch.treats_subordinates || "")
    setNewCharTreatsLovedOnes(ch.treats_loved_ones || "")
    
    // Backstory & Timeline
    setNewCharChildhoodSituation(ch.childhood_situation || "")
    setNewCharImportantChildhoodEvent1(ch.important_childhood_event_1 || "")
    setNewCharImportantTeenEvent(ch.important_teen_event || "")
    setNewCharImportantAdulthoodEvent(ch.important_adulthood_event || "")
    setNewCharMajorTraumaOrLoss(ch.major_trauma_or_loss || "")
    setNewCharBiggestVictoryOrSuccess(ch.biggest_victory_or_success || "")
    setNewCharWhatChangedBeforeStory(ch.what_changed_before_story || "")
    setNewCharPersonalSecrets(ch.personal_secrets || "")
    setNewCharTruthHiddenFromSelf(ch.truth_hidden_from_self || "")
    
    // Relationships
    setNewCharParentsInfo(ch.parents_info || "")
    setNewCharSiblingsInfo(ch.siblings_info || "")
    setNewCharOtherFamilyInfo(ch.other_family_info || "")
    setNewCharBestFriends((ch.best_friends || []).join(", ") || "")
    setNewCharOtherFriendsAllies((ch.other_friends_allies || []).join(", ") || "")
    setNewCharRomanticStatus(ch.romantic_status || "")
    setNewCharImportantExes(ch.important_exes || "")
    setNewCharEnemiesRivals((ch.enemies_rivals || []).join(", ") || "")
    setNewCharMentors((ch.mentors || []).join(", ") || "")
    setNewCharPeopleResponsibleFor((ch.people_responsible_for || []).join(", ") || "")
    
    // Story Role & Arc
    setNewCharRoleInStory(ch.role_in_story || "")
    setNewCharCharacterLogline(ch.character_logline || "")
    setNewCharStartingState(ch.starting_state || "")
    setNewCharMidpointChange(ch.midpoint_change || "")
    setNewCharEndState(ch.end_state || "")
    setNewCharKeyDecisions((ch.key_decisions || []).join(", ") || "")
    
    // Practical Details
    setNewCharVehicleType(ch.vehicle_type || "")
    setNewCharVehicleModel(ch.vehicle_model || "")
    setNewCharVehicleColor(ch.vehicle_color || "")
    setNewCharVehicleCondition(ch.vehicle_condition || "")
    setNewCharPhoneTechLevel(ch.phone_tech_level || "")
    setNewCharHomeType(ch.home_type || "")
    setNewCharHomeNeighborhood(ch.home_neighborhood || "")
    setNewCharHomeCondition(ch.home_condition || "")
    setNewCharHomeKeyObjects(ch.home_key_objects || "")
    setNewCharDailyRoutine(ch.daily_routine || "")
    setNewCharJobSchedule(ch.job_schedule || "")
    setNewCharPets((ch.pets || []).join(", ") || "")
    setNewCharHobbies((ch.hobbies || []).join(", ") || "")
    setNewCharAddictionsHabits((ch.addictions_habits || []).join(", ") || "")
    setNewCharHealthIssues(ch.health_issues || "")
    setNewCharReligionSpirituality(ch.religion_spirituality || "")
    setNewCharPoliticalSocialViews(ch.political_social_views || "")
    
    // Dialogue Notes
    setNewCharCommonPhrases((ch.common_phrases || []).join(", ") || "")
    setNewCharSwearingLevel(ch.swearing_level || "")
    setNewCharSpeakingStyle(ch.speaking_style || "")
    setNewCharLanguageSwitches((ch.language_switches || []).map((l: any) => `${l.language} (${l.when})`).join(", ") || "")
    
    // Extra Notes
    setNewCharVisualMotifs((ch.visual_motifs || []).join(", ") || "")
    setNewCharThemeTheyRepresent(ch.theme_they_represent || "")
    setNewCharForeshadowingNotes(ch.foreshadowing_notes || "")
    
    // Clear inline editing state
    setEditingCharacterId(null)
    // Scroll to Characters card
    setTimeout(() => {
      const charactersCard = document.getElementById("characters-form-card")
      if (charactersCard) {
        charactersCard.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  const clearForm = () => {
    setEditingCharacterInFormId(null)
    setNewCharName("")
    setNewCharArchetype("")
    setNewCharDescription("")
    setNewCharBackstory("")
    setNewCharGoals("")
    setNewCharConflicts("")
    setNewCharPersonalityTraits("")
    
    // Core Identity
    setNewCharFullName("")
    setNewCharNicknames("")
    setNewCharBirthdate("")
    setNewCharNationality("")
    setNewCharEthnicity("")
    setNewCharPlaceOfBirth("")
    setNewCharCurrentResidence("")
    setNewCharOccupation("")
    setNewCharEducationLevel("")
    setNewCharSocioEconomicPast("")
    setNewCharSocioEconomicPresent("")
    setNewCharLanguages("")
    
    // Visual Bible
    setNewCharHeight("")
    setNewCharBuild("")
    setNewCharSkinTone("")
    setNewCharEyeColor("")
    setNewCharEyeShape("")
    setNewCharEyeExpression("")
    setNewCharHairColorNatural("")
    setNewCharHairColorCurrent("")
    setNewCharHairLength("")
    setNewCharHairTexture("")
    setNewCharUsualHairstyle("")
    setNewCharFaceShape("")
    setNewCharDistinguishingMarks("")
    setNewCharUsualClothingStyle("")
    setNewCharTypicalColorPalette("")
    setNewCharAccessories("")
    setNewCharPosture("")
    setNewCharBodyLanguage("")
    setNewCharVoicePitch("")
    setNewCharVoiceSpeed("")
    setNewCharVoiceAccent("")
    setNewCharVoiceTone("")
    setNewCharReferenceImages("")
    
    // Psychology
    setNewCharCoreValues("")
    setNewCharMainExternalGoal("")
    setNewCharDeepInternalNeed("")
    setNewCharGreatestFear("")
    setNewCharFatalFlaw("")
    setNewCharKeyStrengths("")
    setNewCharCopingStyleStress("")
    setNewCharBaselinePersonality("")
    setNewCharSenseOfHumor("")
    setNewCharTreatsAuthority("")
    setNewCharTreatsSubordinates("")
    setNewCharTreatsLovedOnes("")
    
    // Backstory & Timeline
    setNewCharChildhoodSituation("")
    setNewCharImportantChildhoodEvent1("")
    setNewCharImportantTeenEvent("")
    setNewCharImportantAdulthoodEvent("")
    setNewCharMajorTraumaOrLoss("")
    setNewCharBiggestVictoryOrSuccess("")
    setNewCharWhatChangedBeforeStory("")
    setNewCharPersonalSecrets("")
    setNewCharTruthHiddenFromSelf("")
    
    // Relationships
    setNewCharParentsInfo("")
    setNewCharSiblingsInfo("")
    setNewCharOtherFamilyInfo("")
    setNewCharBestFriends("")
    setNewCharOtherFriendsAllies("")
    setNewCharRomanticStatus("")
    setNewCharImportantExes("")
    setNewCharEnemiesRivals("")
    setNewCharMentors("")
    setNewCharPeopleResponsibleFor("")
    
    // Story Role & Arc
    setNewCharRoleInStory("")
    setNewCharCharacterLogline("")
    setNewCharStartingState("")
    setNewCharMidpointChange("")
    setNewCharEndState("")
    setNewCharKeyDecisions("")
    
    // Practical Details
    setNewCharVehicleType("")
    setNewCharVehicleModel("")
    setNewCharVehicleColor("")
    setNewCharVehicleCondition("")
    setNewCharPhoneTechLevel("")
    setNewCharHomeType("")
    setNewCharHomeNeighborhood("")
    setNewCharHomeCondition("")
    setNewCharHomeKeyObjects("")
    setNewCharDailyRoutine("")
    setNewCharJobSchedule("")
    setNewCharPets("")
    setNewCharHobbies("")
    setNewCharAddictionsHabits("")
    setNewCharHealthIssues("")
    setNewCharReligionSpirituality("")
    setNewCharPoliticalSocialViews("")
    
    // Dialogue Notes
    setNewCharCommonPhrases("")
    setNewCharSwearingLevel("")
    setNewCharSpeakingStyle("")
    setNewCharLanguageSwitches("")
    
    // Extra Notes
    setNewCharVisualMotifs("")
    setNewCharThemeTheyRepresent("")
    setNewCharForeshadowingNotes("")
  }

  const saveEdit = async (id: string) => {
    if (!projectId) return
    try {
      setIsSavingEdit(true)
      const traits = editTraits
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
      const updated = await CharactersService.updateCharacter(id, {
        name: editName.trim() || undefined,
        archetype: editArchetype || undefined,
        description: editDescription || undefined,
        backstory: editBackstory || undefined,
        goals: editGoals || undefined,
        conflicts: editConflicts || undefined,
        personality: traits.length ? { traits } : { traits: [] },
      })
      setCharacters(prev => prev.map(c => c.id === id ? updated : c))
      setEditingCharacterId(null)
      toast({ title: "Character updated", description: `"${updated.name}" saved.` })
    } catch (e) {
      console.error('Save character failed:', e)
      toast({ title: "Error", description: "Failed to save character.", variant: "destructive" })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const deleteCharacter = async (id: string) => {
    if (!confirm("Delete this character? This cannot be undone.")) return
    try {
      setIsDeletingId(id)
      await CharactersService.deleteCharacter(id)
      setCharacters(prev => prev.filter(c => c.id !== id))
      toast({ title: "Deleted", description: "Character removed." })
    } catch (e) {
      console.error('Delete character failed:', e)
      toast({ title: "Error", description: "Failed to delete character.", variant: "destructive" })
    } finally {
      setIsDeletingId(null)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const generateCharactersFromTreatment = async () => {
    if (!projectId) return
    try {
      setIsGeneratingFromTreatment(true)
      // Load treatment
      const treatment = await TreatmentsService.getTreatmentByProjectId(projectId)
      if (!treatment) {
        toast({ title: "No Treatment", description: "Create a treatment for this project first.", variant: "destructive" })
        return
      }

      // Get user and OpenAI key from users table
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      const userId = session?.user?.id
      if (!userId) {
        toast({ title: "Auth required", description: "Please sign in again.", variant: "destructive" })
        return
      }
      const { data: userRow, error: userErr } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key')
        .eq('id', userId)
        .single()
      if (userErr || !userRow?.openai_api_key) {
        toast({ title: "Missing API Key", description: "Set your OpenAI API key in settings.", variant: "destructive" })
        return
      }

      // Determine model from AI settings (scripts tab)
      let model = 'gpt-4o-mini'
      try {
        const scriptsSetting = await AISettingsService.getTabSetting(userId, 'scripts')
        if (scriptsSetting?.selected_model) {
          model = scriptsSetting.selected_model
        }
      } catch {}

      // Check if a character is selected
      const selectedChar = selectedCharacterId ? characters.find(c => c.id === selectedCharacterId) : null

      // Build prompt
      const treatmentContext = [
        treatment.title && `Title: ${treatment.title}`,
        treatment.logline && `Logline: ${treatment.logline}`,
        treatment.synopsis && `Synopsis: ${treatment.synopsis}`,
        treatment.themes && `Themes: ${treatment.themes}`,
        treatment.characters && `Existing Notes (characters text): ${treatment.characters}`,
      ].filter(Boolean).join('\n')

      let template, prompt
      if (selectedChar) {
        // Generate only basic details for a specific character (top section only)
        template = `
Return STRICT JSON (no prose) as:
{
  "name": "string",
  "archetype": "string",
  "description": "string",
  "backstory": "string",
  "goals": "string",
  "conflicts": "string",
  "personality": { "traits": ["string", "string"] }
}
Generate basic character details for "${selectedChar.name}". Keep the name exactly as "${selectedChar.name}". Focus on the core character information: archetype, description, backstory, goals, conflicts, and personality traits.`
        
        prompt = `Based on the following treatment, generate basic character details for "${selectedChar.name}". Include archetype, description, backstory, goals/motivations, conflicts, and personality traits.\n\n${treatmentContext}`
      } else {
        // Generate multiple characters
        template = `
Return STRICT JSON (no prose) as:
{
  "characters": [
    {
      "name": "string",
      "archetype": "string",
      "description": "string",
      "backstory": "string",
      "goals": "string",
      "conflicts": "string",
      "personality": { "traits": ["string", "string"] }
    }
  ]
}
Keep names consistent and useful for casting. Limit to 5-8 strongest characters.`

        prompt = `Based on the following treatment, propose a concise set of character profiles.\n\n${treatmentContext}`
      }

      const resp = await OpenAIService.generateScript({
        prompt,
        template,
        model, // used by ai-services OpenAIService
        apiKey: userRow.openai_api_key,
      } as any)

      if (!resp.success) {
        throw new Error(resp.error || 'AI generation failed')
      }

      // Extract JSON text from Chat Completions
      let text = ''
      try {
        const choice = resp.data?.choices?.[0]
        text = choice?.message?.content || resp.data?.text || ''
      } catch {}

      // Find JSON in text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const jsonText = jsonMatch ? jsonMatch[0] : text
      const parsed = JSON.parse(jsonText)

      if (selectedChar) {
        // Update the selected character with generated basic details only
        const item = parsed
        const traits = item.personality?.traits || []
        
        // Load into form - Basic fields only
        setEditingCharacterInFormId(selectedChar.id)
        setNewCharName(item.name || selectedChar.name || "")
        setNewCharArchetype(item.archetype || "")
        setNewCharDescription(item.description || "")
        setNewCharBackstory(item.backstory || "")
        setNewCharGoals(item.goals || "")
        setNewCharConflicts(item.conflicts || "")
        setNewCharPersonalityTraits(Array.isArray(traits) ? traits.join(", ") : "")
        
        // Scroll to Characters card
        setTimeout(() => {
          const charactersCard = document.getElementById("characters-form-card")
          if (charactersCard) {
            charactersCard.scrollIntoView({ behavior: "smooth", block: "nearest" })
          }
        }, 100)
        
        toast({ title: "Character details generated", description: `Basic details for "${selectedChar.name}" have been filled in. Use individual section buttons to generate more details.` })
      } else {
        // Create multiple characters
      const list = Array.isArray(parsed?.characters) ? parsed.characters : []
      if (list.length === 0) {
        throw new Error('No characters returned from AI')
      }

      const created: Character[] = []
      for (const item of list) {
        try {
          const createdChar = await CharactersService.createCharacter({
            project_id: projectId,
            name: String(item.name || '').trim() || 'Unnamed',
            archetype: item.archetype || undefined,
            description: item.description || undefined,
            backstory: item.backstory || undefined,
            goals: item.goals || undefined,
            conflicts: item.conflicts || undefined,
            personality: item.personality || undefined,
          })
          created.push(createdChar)
        } catch (e) {
          console.error('Failed to create one character:', e)
        }
      }

      if (created.length > 0) {
        setCharacters(prev => [...created, ...prev])
        toast({ title: "Characters generated", description: `Added ${created.length} character(s).` })
      } else {
        toast({ title: "No characters created", description: "AI returned no valid characters.", variant: "destructive" })
        }
      }
    } catch (error) {
      console.error('AI generation error:', error)
      toast({ title: "AI Error", description: error instanceof Error ? error.message : 'Failed to generate characters', variant: "destructive" })
    } finally {
      setIsGeneratingFromTreatment(false)
    }
  }

  const generateSectionContent = async (section: string) => {
    if (!projectId || !selectedCharacterId) {
      toast({ title: "Error", description: "Please select a character first.", variant: "destructive" })
      return
    }

    const selectedChar = characters.find(c => c.id === selectedCharacterId)
    if (!selectedChar) {
      toast({ title: "Error", description: "Character not found.", variant: "destructive" })
      return
    }

    try {
      setGeneratingSection(section)
      
      // Load treatment
      const treatment = await TreatmentsService.getTreatmentByProjectId(projectId)
      if (!treatment) {
        toast({ title: "No Treatment", description: "Create a treatment for this project first.", variant: "destructive" })
        return
      }

      // Get user and OpenAI key
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      const userId = session?.user?.id
      if (!userId) {
        toast({ title: "Auth required", description: "Please sign in again.", variant: "destructive" })
        return
      }
      const { data: userRow, error: userErr } = await getSupabaseClient()
        .from('users')
        .select('openai_api_key')
        .eq('id', userId)
        .single()
      if (userErr || !userRow?.openai_api_key) {
        toast({ title: "Missing API Key", description: "Set your OpenAI API key in settings.", variant: "destructive" })
        return
      }

      // Determine model
      let model = 'gpt-4o-mini'
      try {
        const scriptsSetting = await AISettingsService.getTabSetting(userId, 'scripts')
        if (scriptsSetting?.selected_model) {
          model = scriptsSetting.selected_model
        }
      } catch {}

      // Build context
      const treatmentContext = [
        treatment.title && `Title: ${treatment.title}`,
        treatment.logline && `Logline: ${treatment.logline}`,
        treatment.synopsis && `Synopsis: ${treatment.synopsis}`,
        treatment.themes && `Themes: ${treatment.themes}`,
      ].filter(Boolean).join('\n')

      // Get existing character data for context
      const existingData = {
        name: selectedChar.name,
        archetype: selectedChar.archetype,
        description: selectedChar.description,
        backstory: selectedChar.backstory,
        goals: selectedChar.goals,
        conflicts: selectedChar.conflicts,
      }

      // Section-specific templates and prompts
      const sectionConfigs: Record<string, { template: string; prompt: string }> = {
        'core-identity': {
          template: `{
  "full_name": "string",
  "nicknames": ["string"],
  "birthdate": "YYYY-MM-DD",
  "nationality": "string",
  "ethnicity": "string",
  "place_of_birth": "string",
  "current_residence": "string",
  "occupation": "string",
  "education_level": "string",
  "socio_economic_status_past": "string",
  "socio_economic_status_present": "string",
  "languages_spoken": [{"language": "string", "fluency": "string"}]
}`,
          prompt: `Generate Core Identity details for "${selectedChar.name}". Include full name, nicknames, birthdate, nationality, ethnicity, place of birth, current residence, occupation, education, socio-economic status (past and present), and languages spoken with fluency levels.`
        },
        'visual-bible': {
          template: `{
  "height": "string",
  "build": "string",
  "skin_tone": "string",
  "eye_color": "string",
  "eye_shape": "string",
  "eye_expression": "string",
  "hair_color_natural": "string",
  "hair_color_current": "string",
  "hair_length": "string",
  "hair_texture": "string",
  "usual_hairstyle": "string",
  "face_shape": "string",
  "distinguishing_marks": "string",
  "usual_clothing_style": "string",
  "typical_color_palette": ["string"],
  "accessories": "string",
  "posture": "string",
  "body_language": "string",
  "voice_pitch": "string",
  "voice_speed": "string",
  "voice_accent": "string",
  "voice_tone": "string"
}`,
          prompt: `Generate Visual Bible details for "${selectedChar.name}". Include all physical appearance details: height, build, skin tone, eyes, hair, face shape, distinguishing marks, clothing style, color palette, accessories, posture, body language, and voice characteristics (pitch, speed, accent, tone).`
        },
        'psychology': {
          template: `{
  "core_values": ["string"],
  "main_external_goal": "string",
  "deep_internal_need": "string",
  "greatest_fear": "string",
  "fatal_flaw": "string",
  "key_strengths": ["string"],
  "coping_style_stress": "string",
  "baseline_personality": "string",
  "sense_of_humor": "string",
  "treats_authority": "string",
  "treats_subordinates": "string",
  "treats_loved_ones": "string"
}`,
          prompt: `Generate Psychology details for "${selectedChar.name}". Include core values (3-5), main external goal, deep internal need, greatest fear, fatal flaw, key strengths (3-5), coping style under stress, baseline personality, sense of humor, and how they treat authority, subordinates, and loved ones.`
        },
        'backstory': {
          template: `{
  "childhood_situation": "string",
  "important_childhood_event_1": "string",
  "important_teen_event": "string",
  "important_adulthood_event": "string",
  "major_trauma_or_loss": "string",
  "biggest_victory_or_success": "string",
  "what_changed_before_story": "string",
  "personal_secrets": "string",
  "truth_hidden_from_self": "string"
}`,
          prompt: `Generate Backstory & Timeline details for "${selectedChar.name}". Include childhood situation, important events (childhood, teen, adulthood), major trauma or loss, biggest victory, what changed before the story starts, personal secrets, and truth hidden from self.`
        },
        'relationships': {
          template: `{
  "parents_info": "string",
  "siblings_info": "string",
  "other_family_info": "string",
  "best_friends": ["string"],
  "other_friends_allies": ["string"],
  "romantic_status": "string",
  "important_exes": "string",
  "enemies_rivals": ["string"],
  "mentors": ["string"],
  "people_responsible_for": ["string"]
}`,
          prompt: `Generate Relationships details for "${selectedChar.name}". Include parents, siblings, other family, best friends, other friends/allies, romantic status, important exes, enemies/rivals, mentors, and people they are responsible for.`
        },
        'story-arc': {
          template: `{
  "role_in_story": "string",
  "character_logline": "string",
  "starting_state": "string",
  "midpoint_change": "string",
  "end_state": "string",
  "key_decisions": ["string"]
}`,
          prompt: `Generate Story Role & Arc details for "${selectedChar.name}". Include role in story (one sentence), character logline ("A [adjective] [role] who wants [goal] but is held back by [flaw/fear]"), starting state, midpoint change, end state, and key decisions (3-5) that drive the plot.`
        },
        'practical': {
          template: `{
  "vehicle_type": "string",
  "vehicle_model": "string",
  "vehicle_color": "string",
  "vehicle_condition": "string",
  "phone_tech_level": "string",
  "home_type": "string",
  "home_neighborhood": "string",
  "home_condition": "string",
  "home_key_objects": "string",
  "daily_routine": "string",
  "job_schedule": "string",
  "pets": ["string"],
  "hobbies": ["string"],
  "addictions_habits": ["string"],
  "health_issues": "string",
  "religion_spirituality": "string",
  "political_social_views": "string"
}`,
          prompt: `Generate Practical Details for "${selectedChar.name}". Include vehicle (type, model, color, condition), phone/tech level, home (type, neighborhood, condition, key objects), daily routine, job schedule, pets, hobbies, addictions/habits, health issues, religion/spirituality, and political/social views.`
        },
        'dialogue': {
          template: `{
  "common_phrases": ["string"],
  "swearing_level": "string",
  "speaking_style": "string",
  "language_switches": [{"language": "string", "when": "string"}]
}`,
          prompt: `Generate Dialogue Notes for "${selectedChar.name}". Include common phrases or slang, swearing level (none/light/heavy), speaking style (short and direct, long and poetic, rambly, formal), and language switches with when they occur.`
        },
        'extra': {
          template: `{
  "visual_motifs": ["string"],
  "theme_they_represent": "string",
  "foreshadowing_notes": "string"
}`,
          prompt: `Generate Extra Notes for "${selectedChar.name}". Include visual motifs (objects, colors, symbols tied to them), theme they represent in the story, and foreshadowing notes.`
        }
      }

      const config = sectionConfigs[section]
      if (!config) {
        toast({ title: "Error", description: "Invalid section.", variant: "destructive" })
        return
      }

      const fullPrompt = `${config.prompt}\n\nCharacter context:\nName: ${existingData.name}\n${existingData.archetype ? `Archetype: ${existingData.archetype}\n` : ''}${existingData.description ? `Description: ${existingData.description}\n` : ''}${existingData.backstory ? `Backstory: ${existingData.backstory}\n` : ''}\nTreatment context:\n${treatmentContext}`

      const resp = await OpenAIService.generateScript({
        prompt: fullPrompt,
        template: `Return STRICT JSON (no prose) as:\n${config.template}\nGenerate comprehensive details for the ${section} section.`,
        model,
        apiKey: userRow.openai_api_key,
      } as any)

      if (!resp.success) {
        throw new Error(resp.error || 'AI generation failed')
      }

      // Extract JSON
      let text = ''
      try {
        const choice = resp.data?.choices?.[0]
        text = choice?.message?.content || resp.data?.text || ''
      } catch {}

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const jsonText = jsonMatch ? jsonMatch[0] : text
      const parsed = JSON.parse(jsonText)

      // Populate only the relevant section fields
      if (section === 'core-identity') {
        setNewCharFullName(parsed.full_name || "")
        setNewCharNicknames(Array.isArray(parsed.nicknames) ? parsed.nicknames.join(", ") : "")
        setNewCharBirthdate(parsed.birthdate || "")
        setNewCharNationality(parsed.nationality || "")
        setNewCharEthnicity(parsed.ethnicity || "")
        setNewCharPlaceOfBirth(parsed.place_of_birth || "")
        setNewCharCurrentResidence(parsed.current_residence || "")
        setNewCharOccupation(parsed.occupation || "")
        setNewCharEducationLevel(parsed.education_level || "")
        setNewCharSocioEconomicPast(parsed.socio_economic_status_past || "")
        setNewCharSocioEconomicPresent(parsed.socio_economic_status_present || "")
        setNewCharLanguages(Array.isArray(parsed.languages_spoken) ? parsed.languages_spoken.map((l: any) => `${l.language} (${l.fluency})`).join(", ") : "")
      } else if (section === 'visual-bible') {
        setNewCharHeight(parsed.height || "")
        setNewCharBuild(parsed.build || "")
        setNewCharSkinTone(parsed.skin_tone || "")
        setNewCharEyeColor(parsed.eye_color || "")
        setNewCharEyeShape(parsed.eye_shape || "")
        setNewCharEyeExpression(parsed.eye_expression || "")
        setNewCharHairColorNatural(parsed.hair_color_natural || "")
        setNewCharHairColorCurrent(parsed.hair_color_current || "")
        setNewCharHairLength(parsed.hair_length || "")
        setNewCharHairTexture(parsed.hair_texture || "")
        setNewCharUsualHairstyle(parsed.usual_hairstyle || "")
        setNewCharFaceShape(parsed.face_shape || "")
        setNewCharDistinguishingMarks(parsed.distinguishing_marks || "")
        setNewCharUsualClothingStyle(parsed.usual_clothing_style || "")
        setNewCharTypicalColorPalette(Array.isArray(parsed.typical_color_palette) ? parsed.typical_color_palette.join(", ") : "")
        setNewCharAccessories(parsed.accessories || "")
        setNewCharPosture(parsed.posture || "")
        setNewCharBodyLanguage(parsed.body_language || "")
        setNewCharVoicePitch(parsed.voice_pitch || "")
        setNewCharVoiceSpeed(parsed.voice_speed || "")
        setNewCharVoiceAccent(parsed.voice_accent || "")
        setNewCharVoiceTone(parsed.voice_tone || "")
      } else if (section === 'psychology') {
        setNewCharCoreValues(Array.isArray(parsed.core_values) ? parsed.core_values.join(", ") : "")
        setNewCharMainExternalGoal(parsed.main_external_goal || "")
        setNewCharDeepInternalNeed(parsed.deep_internal_need || "")
        setNewCharGreatestFear(parsed.greatest_fear || "")
        setNewCharFatalFlaw(parsed.fatal_flaw || "")
        setNewCharKeyStrengths(Array.isArray(parsed.key_strengths) ? parsed.key_strengths.join(", ") : "")
        setNewCharCopingStyleStress(parsed.coping_style_stress || "")
        setNewCharBaselinePersonality(parsed.baseline_personality || "")
        setNewCharSenseOfHumor(parsed.sense_of_humor || "")
        setNewCharTreatsAuthority(parsed.treats_authority || "")
        setNewCharTreatsSubordinates(parsed.treats_subordinates || "")
        setNewCharTreatsLovedOnes(parsed.treats_loved_ones || "")
      } else if (section === 'backstory') {
        setNewCharChildhoodSituation(parsed.childhood_situation || "")
        setNewCharImportantChildhoodEvent1(parsed.important_childhood_event_1 || "")
        setNewCharImportantTeenEvent(parsed.important_teen_event || "")
        setNewCharImportantAdulthoodEvent(parsed.important_adulthood_event || "")
        setNewCharMajorTraumaOrLoss(parsed.major_trauma_or_loss || "")
        setNewCharBiggestVictoryOrSuccess(parsed.biggest_victory_or_success || "")
        setNewCharWhatChangedBeforeStory(parsed.what_changed_before_story || "")
        setNewCharPersonalSecrets(parsed.personal_secrets || "")
        setNewCharTruthHiddenFromSelf(parsed.truth_hidden_from_self || "")
      } else if (section === 'relationships') {
        setNewCharParentsInfo(parsed.parents_info || "")
        setNewCharSiblingsInfo(parsed.siblings_info || "")
        setNewCharOtherFamilyInfo(parsed.other_family_info || "")
        setNewCharBestFriends(Array.isArray(parsed.best_friends) ? parsed.best_friends.join(", ") : "")
        setNewCharOtherFriendsAllies(Array.isArray(parsed.other_friends_allies) ? parsed.other_friends_allies.join(", ") : "")
        setNewCharRomanticStatus(parsed.romantic_status || "")
        setNewCharImportantExes(parsed.important_exes || "")
        setNewCharEnemiesRivals(Array.isArray(parsed.enemies_rivals) ? parsed.enemies_rivals.join(", ") : "")
        setNewCharMentors(Array.isArray(parsed.mentors) ? parsed.mentors.join(", ") : "")
        setNewCharPeopleResponsibleFor(Array.isArray(parsed.people_responsible_for) ? parsed.people_responsible_for.join(", ") : "")
      } else if (section === 'story-arc') {
        setNewCharRoleInStory(parsed.role_in_story || "")
        setNewCharCharacterLogline(parsed.character_logline || "")
        setNewCharStartingState(parsed.starting_state || "")
        setNewCharMidpointChange(parsed.midpoint_change || "")
        setNewCharEndState(parsed.end_state || "")
        setNewCharKeyDecisions(Array.isArray(parsed.key_decisions) ? parsed.key_decisions.join(", ") : "")
      } else if (section === 'practical') {
        setNewCharVehicleType(parsed.vehicle_type || "")
        setNewCharVehicleModel(parsed.vehicle_model || "")
        setNewCharVehicleColor(parsed.vehicle_color || "")
        setNewCharVehicleCondition(parsed.vehicle_condition || "")
        setNewCharPhoneTechLevel(parsed.phone_tech_level || "")
        setNewCharHomeType(parsed.home_type || "")
        setNewCharHomeNeighborhood(parsed.home_neighborhood || "")
        setNewCharHomeCondition(parsed.home_condition || "")
        setNewCharHomeKeyObjects(parsed.home_key_objects || "")
        setNewCharDailyRoutine(parsed.daily_routine || "")
        setNewCharJobSchedule(parsed.job_schedule || "")
        setNewCharPets(Array.isArray(parsed.pets) ? parsed.pets.join(", ") : "")
        setNewCharHobbies(Array.isArray(parsed.hobbies) ? parsed.hobbies.join(", ") : "")
        setNewCharAddictionsHabits(Array.isArray(parsed.addictions_habits) ? parsed.addictions_habits.join(", ") : "")
        setNewCharHealthIssues(parsed.health_issues || "")
        setNewCharReligionSpirituality(parsed.religion_spirituality || "")
        setNewCharPoliticalSocialViews(parsed.political_social_views || "")
      } else if (section === 'dialogue') {
        setNewCharCommonPhrases(Array.isArray(parsed.common_phrases) ? parsed.common_phrases.join(", ") : "")
        setNewCharSwearingLevel(parsed.swearing_level || "")
        setNewCharSpeakingStyle(parsed.speaking_style || "")
        setNewCharLanguageSwitches(Array.isArray(parsed.language_switches) ? parsed.language_switches.map((l: any) => `${l.language} (${l.when})`).join(", ") : "")
      } else if (section === 'extra') {
        setNewCharVisualMotifs(Array.isArray(parsed.visual_motifs) ? parsed.visual_motifs.join(", ") : "")
        setNewCharThemeTheyRepresent(parsed.theme_they_represent || "")
        setNewCharForeshadowingNotes(parsed.foreshadowing_notes || "")
      }

      toast({ title: "Section generated", description: `Generated ${section} content for "${selectedChar.name}".` })
    } catch (error) {
      console.error('AI generation error:', error)
      toast({ title: "AI Error", description: error instanceof Error ? error.message : 'Failed to generate section', variant: "destructive" })
    } finally {
      setGeneratingSection(null)
    }
  }

  const addRole = async (name: string) => {
    if (!projectId || !name.trim()) return
    setSyncing(true)
    try {
      const current = castingSettings?.roles_available || []
      if (current.some((r) => r.toLowerCase() === name.trim().toLowerCase())) {
        toast({ title: "Already Added", description: `"${name}" is already in casting roles.` })
        return
      }
      const next = [...current, name.trim()]
      const updated = await CastingService.upsertCastingSettings(projectId, { roles_available: next })
      setCastingSettings(updated)
      toast({ title: "Role Added", description: `"${name}" added to casting roles.` })
    } catch (err) {
      console.error("Failed adding role:", err)
      toast({ title: "Error", description: "Failed to add role.", variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  const addNewCharacterAsRole = async () => {
    if (!newCharacter.trim()) return
    await addRole(newCharacter.trim())
    setNewCharacter("")
  }

  const syncAllMissingToRoles = async () => {
    if (!projectId || missingInRoles.length === 0) return
    setSyncing(true)
    try {
      const current = castingSettings?.roles_available || []
      const merged = Array.from(
        new Set([...current, ...missingInRoles].map((r) => r.trim())).values(),
      )
      const updated = await CastingService.upsertCastingSettings(projectId, { roles_available: merged })
      setCastingSettings(updated)
      toast({ title: "Synced", description: "All detected characters synced to casting roles." })
    } catch (err) {
      console.error("Failed syncing roles:", err)
      toast({ title: "Error", description: "Failed to sync roles.", variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  const createCharacter = async (namePrefill?: string) => {
    if (!projectId) return
    const name = (namePrefill ?? newCharName).trim()
    if (!name) {
      toast({ title: "Name required", description: "Please enter a character name.", variant: "destructive" })
      return
    }
    try {
      setIsCreatingCharacter(true)
      const traits = newCharPersonalityTraits
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
      
      // Parse array fields
      const parseArray = (str: string) => str.split(",").map(s => s.trim()).filter(Boolean)
      const parseLanguages = (str: string) => {
        if (!str.trim()) return []
        return str.split(",").map(s => {
          const match = s.trim().match(/^(.+?)\s*\((.+?)\)$/)
          if (match) {
            return { language: match[1].trim(), fluency: match[2].trim() }
          }
          return { language: s.trim(), fluency: "fluent" }
        })
      }
      const parseLanguageSwitches = (str: string) => {
        if (!str.trim()) return []
        return str.split(",").map(s => {
          const match = s.trim().match(/^(.+?)\s*\((.+?)\)$/)
          if (match) {
            return { language: match[1].trim(), when: match[2].trim() }
          }
          return { language: s.trim(), when: "" }
        })
      }
      
      const characterData: any = {
          name: name || undefined,
          archetype: newCharArchetype || undefined,
          description: newCharDescription || undefined,
          backstory: newCharBackstory || undefined,
          goals: newCharGoals || undefined,
          conflicts: newCharConflicts || undefined,
          personality: traits.length ? { traits } : { traits: [] },
        
        // Core Identity
        full_name: newCharFullName || undefined,
        nicknames: parseArray(newCharNicknames),
        birthdate: newCharBirthdate || undefined,
        nationality: newCharNationality || undefined,
        ethnicity: newCharEthnicity || undefined,
        place_of_birth: newCharPlaceOfBirth || undefined,
        current_residence: newCharCurrentResidence || undefined,
        occupation: newCharOccupation || undefined,
        education_level: newCharEducationLevel || undefined,
        socio_economic_status_past: newCharSocioEconomicPast || undefined,
        socio_economic_status_present: newCharSocioEconomicPresent || undefined,
        languages_spoken: parseLanguages(newCharLanguages),
        
        // Visual Bible
        height: newCharHeight || undefined,
        build: newCharBuild || undefined,
        skin_tone: newCharSkinTone || undefined,
        eye_color: newCharEyeColor || undefined,
        eye_shape: newCharEyeShape || undefined,
        eye_expression: newCharEyeExpression || undefined,
        hair_color_natural: newCharHairColorNatural || undefined,
        hair_color_current: newCharHairColorCurrent || undefined,
        hair_length: newCharHairLength || undefined,
        hair_texture: newCharHairTexture || undefined,
        usual_hairstyle: newCharUsualHairstyle || undefined,
        face_shape: newCharFaceShape || undefined,
        distinguishing_marks: newCharDistinguishingMarks || undefined,
        usual_clothing_style: newCharUsualClothingStyle || undefined,
        typical_color_palette: parseArray(newCharTypicalColorPalette),
        accessories: newCharAccessories || undefined,
        posture: newCharPosture || undefined,
        body_language: newCharBodyLanguage || undefined,
        voice_pitch: newCharVoicePitch || undefined,
        voice_speed: newCharVoiceSpeed || undefined,
        voice_accent: newCharVoiceAccent || undefined,
        voice_tone: newCharVoiceTone || undefined,
        reference_images: parseArray(newCharReferenceImages),
        
        // Psychology
        core_values: parseArray(newCharCoreValues),
        main_external_goal: newCharMainExternalGoal || undefined,
        deep_internal_need: newCharDeepInternalNeed || undefined,
        greatest_fear: newCharGreatestFear || undefined,
        fatal_flaw: newCharFatalFlaw || undefined,
        key_strengths: parseArray(newCharKeyStrengths),
        coping_style_stress: newCharCopingStyleStress || undefined,
        baseline_personality: newCharBaselinePersonality || undefined,
        sense_of_humor: newCharSenseOfHumor || undefined,
        treats_authority: newCharTreatsAuthority || undefined,
        treats_subordinates: newCharTreatsSubordinates || undefined,
        treats_loved_ones: newCharTreatsLovedOnes || undefined,
        
        // Backstory & Timeline
        childhood_situation: newCharChildhoodSituation || undefined,
        important_childhood_event_1: newCharImportantChildhoodEvent1 || undefined,
        important_teen_event: newCharImportantTeenEvent || undefined,
        important_adulthood_event: newCharImportantAdulthoodEvent || undefined,
        major_trauma_or_loss: newCharMajorTraumaOrLoss || undefined,
        biggest_victory_or_success: newCharBiggestVictoryOrSuccess || undefined,
        what_changed_before_story: newCharWhatChangedBeforeStory || undefined,
        personal_secrets: newCharPersonalSecrets || undefined,
        truth_hidden_from_self: newCharTruthHiddenFromSelf || undefined,
        
        // Relationships
        parents_info: newCharParentsInfo || undefined,
        siblings_info: newCharSiblingsInfo || undefined,
        other_family_info: newCharOtherFamilyInfo || undefined,
        best_friends: parseArray(newCharBestFriends),
        other_friends_allies: parseArray(newCharOtherFriendsAllies),
        romantic_status: newCharRomanticStatus || undefined,
        important_exes: newCharImportantExes || undefined,
        enemies_rivals: parseArray(newCharEnemiesRivals),
        mentors: parseArray(newCharMentors),
        people_responsible_for: parseArray(newCharPeopleResponsibleFor),
        
        // Story Role & Arc
        role_in_story: newCharRoleInStory || undefined,
        character_logline: newCharCharacterLogline || undefined,
        starting_state: newCharStartingState || undefined,
        midpoint_change: newCharMidpointChange || undefined,
        end_state: newCharEndState || undefined,
        key_decisions: parseArray(newCharKeyDecisions),
        
        // Practical Details
        vehicle_type: newCharVehicleType || undefined,
        vehicle_model: newCharVehicleModel || undefined,
        vehicle_color: newCharVehicleColor || undefined,
        vehicle_condition: newCharVehicleCondition || undefined,
        phone_tech_level: newCharPhoneTechLevel || undefined,
        home_type: newCharHomeType || undefined,
        home_neighborhood: newCharHomeNeighborhood || undefined,
        home_condition: newCharHomeCondition || undefined,
        home_key_objects: newCharHomeKeyObjects || undefined,
        daily_routine: newCharDailyRoutine || undefined,
        job_schedule: newCharJobSchedule || undefined,
        pets: parseArray(newCharPets),
        hobbies: parseArray(newCharHobbies),
        addictions_habits: parseArray(newCharAddictionsHabits),
        health_issues: newCharHealthIssues || undefined,
        religion_spirituality: newCharReligionSpirituality || undefined,
        political_social_views: newCharPoliticalSocialViews || undefined,
        
        // Dialogue Notes
        common_phrases: parseArray(newCharCommonPhrases),
        swearing_level: newCharSwearingLevel || undefined,
        speaking_style: newCharSpeakingStyle || undefined,
        language_switches: parseLanguageSwitches(newCharLanguageSwitches),
        
        // Extra Notes
        visual_motifs: parseArray(newCharVisualMotifs),
        theme_they_represent: newCharThemeTheyRepresent || undefined,
        foreshadowing_notes: newCharForeshadowingNotes || undefined,
      }
      
      // Remove undefined values
      Object.keys(characterData).forEach(key => {
        if (characterData[key] === undefined || 
            (Array.isArray(characterData[key]) && characterData[key].length === 0)) {
          delete characterData[key]
        }
      })
      
      // If editing existing character, update it
      if (editingCharacterInFormId) {
        const updated = await CharactersService.updateCharacter(editingCharacterInFormId, characterData)
        setCharacters(prev => prev.map(c => c.id === editingCharacterInFormId ? updated : c))
        clearForm()
        toast({ title: "Character updated", description: `"${updated.name}" saved.` })
      } else {
        // Create new character
        characterData.project_id = projectId
        const created = await CharactersService.createCharacter(characterData)
      setCharacters([created, ...characters])
      if (!namePrefill) {
          clearForm()
      }
      toast({ title: "Character created", description: `"${created.name}" added.` })
      }
    } catch (err) {
      console.error('Create/update character failed:', err)
      toast({ title: "Error", description: editingCharacterInFormId ? "Failed to update character." : "Failed to create character.", variant: "destructive" })
    } finally {
      setIsCreatingCharacter(false)
    }
  }

  const getFileContentType = (file: File): 'image' | 'video' | 'audio' | 'script' | 'prose' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type === 'application/pdf' || file.type.startsWith('text/') || 
        file.name.endsWith('.txt') || file.name.endsWith('.md') ||
        file.name.endsWith('.doc') || file.name.endsWith('.docx')) return 'prose'
    return 'script'
  }

  const handleFileUpload = async (file: File) => {
    if (!selectedCharacterId || !projectId) {
      toast({
        title: "Error",
        description: "Please select a character first.",
        variant: "destructive",
      })
      return
    }

    setIsUploadingAsset(true)
    try {
      // Upload file to Supabase storage
      const filePath = `${projectId}/characters/${selectedCharacterId}/${Date.now()}_${file.name}`
      
      const { data, error } = await getSupabaseClient().storage
        .from('cinema_files')
        .upload(filePath, file)
      
      if (error) {
        throw new Error(`Upload failed: ${error.message}`)
      }
      
      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = getSupabaseClient().storage
        .from('cinema_files')
        .getPublicUrl(filePath)
      
      const contentType = getFileContentType(file)
      const selectedChar = characters.find(c => c.id === selectedCharacterId)
      
      // Save to assets table
      const assetData = {
        project_id: projectId,
        character_id: selectedCharacterId,
        title: `${selectedChar?.name || 'Character'} - ${file.name}`,
        content_type: contentType,
        content: '',
        content_url: publicUrl,
        prompt: '',
        model: 'manual_upload',
        generation_settings: {},
        metadata: {
          character_name: selectedChar?.name,
          uploaded_at: new Date().toISOString(),
          source: 'character_upload',
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
        }
      }

      const savedAsset = await AssetService.createAsset(assetData)
      setCharacterAssets(prev => [savedAsset, ...prev])
      
      toast({
        title: "Success",
        description: `${file.name} uploaded successfully!`,
      })
    } catch (err) {
      console.error('Upload error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: "Error",
        description: errorMessage.includes('migration') 
          ? 'Database migration required. Please run migration 039_add_character_id_to_assets.sql in Supabase.'
          : `Failed to upload ${file.name}: ${errorMessage}`,
        variant: "destructive",
      })
    } finally {
      setIsUploadingAsset(false)
      // Reset file input
      const input = document.getElementById('character-asset-upload') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      handleFileUpload(file)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Delete this asset? This cannot be undone.")) return
    
    try {
      await AssetService.deleteAsset(assetId)
      setCharacterAssets(prev => prev.filter(a => a.id !== assetId))
      toast({
        title: "Deleted",
        description: "Asset removed.",
      })
    } catch (err) {
      console.error('Delete asset failed:', err)
      toast({
        title: "Error",
        description: "Failed to delete asset.",
        variant: "destructive",
      })
    }
  }

  const getAssetIcon = (asset: Asset) => {
    switch (asset.content_type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />
      case 'video':
        return <Video className="h-4 w-4" />
      case 'audio':
        return <File className="h-4 w-4" />
      default:
        return <File className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent">
              Characters
            </h1>
            <p className="text-muted-foreground">
              Aggregate characters from scenes and manage casting roles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {projectId && (
              <Link href={`/casting/${projectId}`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  Open Casting
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie to manage characters"
          />
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a movie to view and manage characters.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading characters...
          </div>
        ) : (
          <>
            {/* Character Viewer Card */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    View Character
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="character-selector">Select Character</Label>
                  <Select
                    value={selectedCharacterId || ""}
                    onValueChange={(value) => {
                      setSelectedCharacterId(value || null)
                    }}
                    disabled={characters.length === 0}
                  >
                    <SelectTrigger id="character-selector" className="bg-input border-border">
                      <SelectValue placeholder={characters.length === 0 ? "No characters available. Create one below." : "Select a character to view details..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {characters.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No characters available</div>
                      ) : (
                        characters.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            {ch.name}
                            {ch.archetype && ` (${ch.archetype})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                  
                  {selectedCharacterId && (() => {
                    const selectedChar = characters.find(c => c.id === selectedCharacterId)
                    if (!selectedChar) return null
                    
                    return (
                      <div className="space-y-4 p-4 bg-muted/20 rounded-lg border border-border">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Name</Label>
                            <p className="font-semibold text-lg">{selectedChar.name}</p>
                          </div>
                          {selectedChar.archetype && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Archetype</Label>
                              <p className="font-medium">{selectedChar.archetype}</p>
                            </div>
                          )}
                        </div>
                        
                        {selectedChar.description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Description</Label>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{selectedChar.description}</p>
                          </div>
                        )}
                        
                        {selectedChar.backstory && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Backstory</Label>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{selectedChar.backstory}</p>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedChar.goals && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Goals / Motivations</Label>
                              <p className="text-sm mt-1 whitespace-pre-wrap">{selectedChar.goals}</p>
                            </div>
                          )}
                          
                          {selectedChar.conflicts && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Conflicts</Label>
                              <p className="text-sm mt-1 whitespace-pre-wrap">{selectedChar.conflicts}</p>
                            </div>
                          )}
                        </div>
                        
                        {selectedChar.personality?.traits && (selectedChar.personality as any).traits?.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Personality Traits</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(selectedChar.personality as any).traits.map((trait: string, i: number) => (
                                <Badge key={`${selectedChar.id}-trait-${i}`} variant="outline">
                                  {trait}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <Separator />
                        
                        {/* Character Assets Section */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Assets</Label>
                            <div className="flex items-center gap-2">
                              <input
                                id="character-asset-upload"
                                type="file"
                                multiple
                                accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx,.md"
                                onChange={handleFileSelect}
                                className="hidden"
                                disabled={isUploadingAsset}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => document.getElementById('character-asset-upload')?.click()}
                                disabled={isUploadingAsset}
                                className="gap-2"
                              >
                                {isUploadingAsset ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4" />
                                    Upload Assets
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          
                          {isLoadingAssets ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading assets...
                            </div>
                          ) : characterAssets.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                              No assets uploaded yet. Upload images, videos, or files to help build up this character.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {characterAssets.map((asset) => (
                                <div
                                  key={asset.id}
                                  className="relative group border border-border rounded-lg overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                  {asset.content_type === 'image' && asset.content_url ? (
                                    <div className="aspect-video relative">
                                      <img
                                        src={asset.content_url}
                                        alt={asset.title}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => window.open(asset.content_url!, '_blank')}
                                          className="h-8"
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          View
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => handleDeleteAsset(asset.id)}
                                          className="h-8 text-destructive"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4">
                                      <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                          {getAssetIcon(asset)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{asset.title}</p>
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {asset.content_type}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {asset.content_url && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => window.open(asset.content_url!, '_blank')}
                                              className="h-7 w-7"
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                            </Button>
                                          )}
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDeleteAsset(asset.id)}
                                            className="h-7 w-7 text-destructive"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <Separator />
                        
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              loadCharacterIntoForm(selectedChar)
                            }}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit Character
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addRole(selectedChar.name)}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add to Casting
                          </Button>
                        </div>
                      </div>
                    )
                  })()}
                  
                  {!selectedCharacterId && characters.length > 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Select a character from the dropdown to view their full details
                    </div>
                  )}
                  
                  {characters.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No characters created yet. Create your first character below.
                    </div>
                  )}
                </CardContent>
              </Card>
            
            <div className="space-y-6">
            {/* Characters list and create */}
            <Card id="characters-form-card" className="cinema-card">
              <CardHeader className="pb-4">
                <CardTitle>Characters</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {editingCharacterInFormId ? "Edit character details below." : "Create and manage full character profiles for this movie."}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Button variant="outline" size="sm" onClick={generateCharactersFromTreatment} disabled={isGeneratingFromTreatment || !treatmentId} className="gap-2">
                    {isGeneratingFromTreatment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {selectedCharacterId ? "Generate Details for Selected Character" : "Generate from Treatment"}
                  </Button>
                </div>
                <div className="space-y-4">
                  {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                      <Label htmlFor="char-name">Name *</Label>
                    <Input id="char-name" value={newCharName} onChange={(e) => setNewCharName(e.target.value)} className="bg-input border-border" placeholder="e.g., Jane Carter" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="char-archetype">Archetype</Label>
                    <Input id="char-archetype" value={newCharArchetype} onChange={(e) => setNewCharArchetype(e.target.value)} className="bg-input border-border" placeholder="Protagonist, Mentor, Antagonist..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="char-description">Description</Label>
                    <Textarea id="char-description" value={newCharDescription} onChange={(e) => setNewCharDescription(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="Brief overview of the character..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="char-backstory">Backstory</Label>
                    <Textarea id="char-backstory" value={newCharBackstory} onChange={(e) => setNewCharBackstory(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="Key events that shaped them..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="char-goals">Goals/Motivations</Label>
                    <Textarea id="char-goals" value={newCharGoals} onChange={(e) => setNewCharGoals(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="What do they want? Why?" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="char-conflicts">Conflicts</Label>
                    <Textarea id="char-conflicts" value={newCharConflicts} onChange={(e) => setNewCharConflicts(e.target.value)} className="bg-input border-border min-h-[70px]" placeholder="Internal or external obstacles..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="char-traits">Personality Traits (comma-separated)</Label>
                    <Input id="char-traits" value={newCharPersonalityTraits} onChange={(e) => setNewCharPersonalityTraits(e.target.value)} className="bg-input border-border" placeholder="loyal, impulsive, analytical" />
                  </div>
                  </div>

                  {/* Comprehensive Character Sheet */}
                  <Accordion type="multiple" className="w-full">
                    {/* 1. Core Identity */}
                    <AccordionItem value="core-identity">
                      <div className="flex items-center justify-between pr-4">
                        <AccordionTrigger className="flex-1">1. Core Identity</AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generateSectionContent('core-identity')
                          }}
                          disabled={!selectedCharacterId || generatingSection === 'core-identity'}
                          className="gap-2"
                        >
                          {generatingSection === 'core-identity' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="char-full-name">Full Name</Label>
                            <Input id="char-full-name" value={newCharFullName} onChange={(e) => setNewCharFullName(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-nicknames">Nicknames/Aliases (comma-separated)</Label>
                            <Input id="char-nicknames" value={newCharNicknames} onChange={(e) => setNewCharNicknames(e.target.value)} className="bg-input border-border" placeholder="Nick, Johnny" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-birthdate">Birthdate</Label>
                            <Input id="char-birthdate" type="date" value={newCharBirthdate} onChange={(e) => setNewCharBirthdate(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-nationality">Nationality</Label>
                            <Input id="char-nationality" value={newCharNationality} onChange={(e) => setNewCharNationality(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-ethnicity">Ethnicity</Label>
                            <Input id="char-ethnicity" value={newCharEthnicity} onChange={(e) => setNewCharEthnicity(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-place-of-birth">Place of Birth</Label>
                            <Input id="char-place-of-birth" value={newCharPlaceOfBirth} onChange={(e) => setNewCharPlaceOfBirth(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-current-residence">Current Residence</Label>
                            <Input id="char-current-residence" value={newCharCurrentResidence} onChange={(e) => setNewCharCurrentResidence(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-occupation">Occupation</Label>
                            <Input id="char-occupation" value={newCharOccupation} onChange={(e) => setNewCharOccupation(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-education">Education Level</Label>
                            <Input id="char-education" value={newCharEducationLevel} onChange={(e) => setNewCharEducationLevel(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-socio-past">Socio-Economic Status (Past)</Label>
                            <Input id="char-socio-past" value={newCharSocioEconomicPast} onChange={(e) => setNewCharSocioEconomicPast(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-socio-present">Socio-Economic Status (Present)</Label>
                            <Input id="char-socio-present" value={newCharSocioEconomicPresent} onChange={(e) => setNewCharSocioEconomicPresent(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-languages">Languages Spoken (format: "English (fluent), Spanish (conversational)")</Label>
                            <Input id="char-languages" value={newCharLanguages} onChange={(e) => setNewCharLanguages(e.target.value)} className="bg-input border-border" placeholder="English (fluent), Spanish (conversational)" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 2. Visual Bible */}
                    <AccordionItem value="visual-bible">
                      <div className="flex items-center justify-between pr-4">
                        <AccordionTrigger className="flex-1">2. Visual Bible</AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generateSectionContent('visual-bible')
                          }}
                          disabled={!selectedCharacterId || generatingSection === 'visual-bible'}
                          className="gap-2"
                        >
                          {generatingSection === 'visual-bible' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="char-height">Height</Label>
                            <Input id="char-height" value={newCharHeight} onChange={(e) => setNewCharHeight(e.target.value)} className="bg-input border-border" placeholder="5'10&quot; or 175cm" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-build">Build</Label>
                            <Input id="char-build" value={newCharBuild} onChange={(e) => setNewCharBuild(e.target.value)} className="bg-input border-border" placeholder="thin, athletic, average, stocky" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-skin-tone">Skin Tone</Label>
                            <Input id="char-skin-tone" value={newCharSkinTone} onChange={(e) => setNewCharSkinTone(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-eye-color">Eye Color</Label>
                            <Input id="char-eye-color" value={newCharEyeColor} onChange={(e) => setNewCharEyeColor(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-eye-shape">Eye Shape</Label>
                            <Input id="char-eye-shape" value={newCharEyeShape} onChange={(e) => setNewCharEyeShape(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-eye-expression">Eye Expression</Label>
                            <Input id="char-eye-expression" value={newCharEyeExpression} onChange={(e) => setNewCharEyeExpression(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-hair-natural">Hair Color (Natural)</Label>
                            <Input id="char-hair-natural" value={newCharHairColorNatural} onChange={(e) => setNewCharHairColorNatural(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-hair-current">Hair Color (Current)</Label>
                            <Input id="char-hair-current" value={newCharHairColorCurrent} onChange={(e) => setNewCharHairColorCurrent(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-hair-length">Hair Length</Label>
                            <Input id="char-hair-length" value={newCharHairLength} onChange={(e) => setNewCharHairLength(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-hair-texture">Hair Texture</Label>
                            <Input id="char-hair-texture" value={newCharHairTexture} onChange={(e) => setNewCharHairTexture(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-hairstyle">Usual Hairstyle</Label>
                            <Input id="char-hairstyle" value={newCharUsualHairstyle} onChange={(e) => setNewCharUsualHairstyle(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-face-shape">Face Shape</Label>
                            <Input id="char-face-shape" value={newCharFaceShape} onChange={(e) => setNewCharFaceShape(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-distinguishing">Distinguishing Marks</Label>
                            <Textarea id="char-distinguishing" value={newCharDistinguishingMarks} onChange={(e) => setNewCharDistinguishingMarks(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="tattoos, scars, birthmarks, etc." />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-clothing">Usual Clothing Style</Label>
                            <Textarea id="char-clothing" value={newCharUsualClothingStyle} onChange={(e) => setNewCharUsualClothingStyle(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-color-palette">Typical Color Palette (comma-separated)</Label>
                            <Input id="char-color-palette" value={newCharTypicalColorPalette} onChange={(e) => setNewCharTypicalColorPalette(e.target.value)} className="bg-input border-border" placeholder="navy, gray, black" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-accessories">Accessories</Label>
                            <Input id="char-accessories" value={newCharAccessories} onChange={(e) => setNewCharAccessories(e.target.value)} className="bg-input border-border" placeholder="jewelry, glasses, piercings, hats" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-posture">Posture</Label>
                            <Input id="char-posture" value={newCharPosture} onChange={(e) => setNewCharPosture(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-body-language">Body Language</Label>
                            <Input id="char-body-language" value={newCharBodyLanguage} onChange={(e) => setNewCharBodyLanguage(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-voice-pitch">Voice Pitch</Label>
                            <Input id="char-voice-pitch" value={newCharVoicePitch} onChange={(e) => setNewCharVoicePitch(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-voice-speed">Voice Speed</Label>
                            <Input id="char-voice-speed" value={newCharVoiceSpeed} onChange={(e) => setNewCharVoiceSpeed(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-voice-accent">Voice Accent</Label>
                            <Input id="char-voice-accent" value={newCharVoiceAccent} onChange={(e) => setNewCharVoiceAccent(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-voice-tone">Voice Tone</Label>
                            <Input id="char-voice-tone" value={newCharVoiceTone} onChange={(e) => setNewCharVoiceTone(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-reference-images">Reference Images (comma-separated URLs)</Label>
                            <Input id="char-reference-images" value={newCharReferenceImages} onChange={(e) => setNewCharReferenceImages(e.target.value)} className="bg-input border-border" placeholder="url1, url2" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 3. Psychology */}
                    <AccordionItem value="psychology">
                      <div className="flex items-center justify-between pr-4">
                        <AccordionTrigger className="flex-1">3. Psychology</AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generateSectionContent('psychology')
                          }}
                          disabled={!selectedCharacterId || generatingSection === 'psychology'}
                          className="gap-2"
                        >
                          {generatingSection === 'psychology' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-core-values">Core Values (comma-separated, 3-5)</Label>
                            <Input id="char-core-values" value={newCharCoreValues} onChange={(e) => setNewCharCoreValues(e.target.value)} className="bg-input border-border" placeholder="honesty, loyalty, justice" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-external-goal">Main External Goal</Label>
                            <Textarea id="char-external-goal" value={newCharMainExternalGoal} onChange={(e) => setNewCharMainExternalGoal(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="What they want" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-internal-need">Deep Internal Need</Label>
                            <Textarea id="char-internal-need" value={newCharDeepInternalNeed} onChange={(e) => setNewCharDeepInternalNeed(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="What they really lack" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-fear">Greatest Fear</Label>
                            <Textarea id="char-fear" value={newCharGreatestFear} onChange={(e) => setNewCharGreatestFear(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-flaw">Fatal Flaw</Label>
                            <Textarea id="char-flaw" value={newCharFatalFlaw} onChange={(e) => setNewCharFatalFlaw(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-strengths">Key Strengths (comma-separated, 3-5)</Label>
                            <Input id="char-strengths" value={newCharKeyStrengths} onChange={(e) => setNewCharKeyStrengths(e.target.value)} className="bg-input border-border" placeholder="brave, intelligent, empathetic" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-coping">Coping Style Under Stress</Label>
                            <Input id="char-coping" value={newCharCopingStyleStress} onChange={(e) => setNewCharCopingStyleStress(e.target.value)} className="bg-input border-border" placeholder="fight, flight, freeze, fawn, joke" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-baseline">Baseline Personality</Label>
                            <Input id="char-baseline" value={newCharBaselinePersonality} onChange={(e) => setNewCharBaselinePersonality(e.target.value)} className="bg-input border-border" placeholder="introvert/extravert, calm/impulsive" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-humor">Sense of Humor</Label>
                            <Input id="char-humor" value={newCharSenseOfHumor} onChange={(e) => setNewCharSenseOfHumor(e.target.value)} className="bg-input border-border" placeholder="dark, dry, sarcastic, childish, none" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-treats-authority">How They Treat Authority</Label>
                            <Textarea id="char-treats-authority" value={newCharTreatsAuthority} onChange={(e) => setNewCharTreatsAuthority(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-treats-subordinates">How They Treat Subordinates</Label>
                            <Textarea id="char-treats-subordinates" value={newCharTreatsSubordinates} onChange={(e) => setNewCharTreatsSubordinates(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-treats-loved-ones">How They Treat Loved Ones</Label>
                            <Textarea id="char-treats-loved-ones" value={newCharTreatsLovedOnes} onChange={(e) => setNewCharTreatsLovedOnes(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 4. Backstory & Timeline */}
                    <AccordionItem value="backstory">
                      <div className="flex items-center justify-between pr-4">
                        <AccordionTrigger className="flex-1">4. Backstory & Timeline</AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generateSectionContent('backstory')
                          }}
                          disabled={!selectedCharacterId || generatingSection === 'backstory'}
                          className="gap-2"
                        >
                          {generatingSection === 'backstory' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-childhood">Childhood Situation</Label>
                            <Textarea id="char-childhood" value={newCharChildhoodSituation} onChange={(e) => setNewCharChildhoodSituation(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="family, money, environment" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-childhood-event-1">Important Childhood Event #1</Label>
                            <Textarea id="char-childhood-event-1" value={newCharImportantChildhoodEvent1} onChange={(e) => setNewCharImportantChildhoodEvent1(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-teen-event">Important Teen Event</Label>
                            <Textarea id="char-teen-event" value={newCharImportantTeenEvent} onChange={(e) => setNewCharImportantTeenEvent(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-adulthood-event">Important Adulthood Event</Label>
                            <Textarea id="char-adulthood-event" value={newCharImportantAdulthoodEvent} onChange={(e) => setNewCharImportantAdulthoodEvent(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-trauma">Major Trauma or Loss</Label>
                            <Textarea id="char-trauma" value={newCharMajorTraumaOrLoss} onChange={(e) => setNewCharMajorTraumaOrLoss(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-victory">Biggest Victory or Success</Label>
                            <Textarea id="char-victory" value={newCharBiggestVictoryOrSuccess} onChange={(e) => setNewCharBiggestVictoryOrSuccess(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-changed">What Changed Right Before Story Starts</Label>
                            <Textarea id="char-changed" value={newCharWhatChangedBeforeStory} onChange={(e) => setNewCharWhatChangedBeforeStory(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-secrets">Personal Secrets</Label>
                            <Textarea id="char-secrets" value={newCharPersonalSecrets} onChange={(e) => setNewCharPersonalSecrets(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Secrets they hide from others" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-truth-hidden">Truth Hidden From Self</Label>
                            <Textarea id="char-truth-hidden" value={newCharTruthHiddenFromSelf} onChange={(e) => setNewCharTruthHiddenFromSelf(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 5. Relationships */}
                    <AccordionItem value="relationships">
                      <div className="flex items-center justify-between pr-4">
                        <AccordionTrigger className="flex-1">5. Relationships</AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generateSectionContent('relationships')
                          }}
                          disabled={!selectedCharacterId || generatingSection === 'relationships'}
                          className="gap-2"
                        >
                          {generatingSection === 'relationships' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="char-parents">Parents (names, status, relationship)</Label>
                            <Textarea id="char-parents" value={newCharParentsInfo} onChange={(e) => setNewCharParentsInfo(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-siblings">Siblings (names, status, relationship)</Label>
                            <Textarea id="char-siblings" value={newCharSiblingsInfo} onChange={(e) => setNewCharSiblingsInfo(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-other-family">Other Family</Label>
                            <Textarea id="char-other-family" value={newCharOtherFamilyInfo} onChange={(e) => setNewCharOtherFamilyInfo(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="uncles, grandparents, etc." />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-best-friends">Best Friends (comma-separated)</Label>
                            <Input id="char-best-friends" value={newCharBestFriends} onChange={(e) => setNewCharBestFriends(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-other-friends">Other Friends/Allies (comma-separated)</Label>
                            <Input id="char-other-friends" value={newCharOtherFriendsAllies} onChange={(e) => setNewCharOtherFriendsAllies(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-romantic">Romantic Status</Label>
                            <Input id="char-romantic" value={newCharRomanticStatus} onChange={(e) => setNewCharRomanticStatus(e.target.value)} className="bg-input border-border" placeholder="single, partner, ex" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-exes">Important Exes</Label>
                            <Textarea id="char-exes" value={newCharImportantExes} onChange={(e) => setNewCharImportantExes(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Names and why they broke up" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-enemies">Enemies/Rivals (comma-separated)</Label>
                            <Input id="char-enemies" value={newCharEnemiesRivals} onChange={(e) => setNewCharEnemiesRivals(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-mentors">Mentors (comma-separated)</Label>
                            <Input id="char-mentors" value={newCharMentors} onChange={(e) => setNewCharMentors(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-responsible">People They Are Responsible For (comma-separated)</Label>
                            <Input id="char-responsible" value={newCharPeopleResponsibleFor} onChange={(e) => setNewCharPeopleResponsibleFor(e.target.value)} className="bg-input border-border" placeholder="kids, students, crew" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 6. Story Role & Arc */}
                    <AccordionItem value="story-arc">
                      <div className="flex items-center justify-between pr-4">
                        <AccordionTrigger className="flex-1">6. Story Role & Arc</AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generateSectionContent('story-arc')
                          }}
                          disabled={!selectedCharacterId || generatingSection === 'story-arc'}
                          className="gap-2"
                        >
                          {generatingSection === 'story-arc' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-role">Role in Story (one sentence)</Label>
                            <Textarea id="char-role" value={newCharRoleInStory} onChange={(e) => setNewCharRoleInStory(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-logline">Character Logline</Label>
                            <Textarea id="char-logline" value={newCharCharacterLogline} onChange={(e) => setNewCharCharacterLogline(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="A [adjective] [role] who wants [goal] but is held back by [flaw/fear]." />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-starting">Starting State</Label>
                            <Textarea id="char-starting" value={newCharStartingState} onChange={(e) => setNewCharStartingState(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Beliefs, attitude, life situation at beginning" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-midpoint">Midpoint Change</Label>
                            <Textarea id="char-midpoint" value={newCharMidpointChange} onChange={(e) => setNewCharMidpointChange(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Event that shakes their worldview" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-end">End State</Label>
                            <Textarea id="char-end" value={newCharEndState} onChange={(e) => setNewCharEndState(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="How they change by the end" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-decisions">Key Decisions (comma-separated, 3-5)</Label>
                            <Textarea id="char-decisions" value={newCharKeyDecisions} onChange={(e) => setNewCharKeyDecisions(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="Decisions that drive the plot" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 7. Practical Details */}
                    <AccordionItem value="practical">
                      <div className="flex items-center justify-between pr-4">
                        <AccordionTrigger className="flex-1">7. Practical Details / Continuity</AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generateSectionContent('practical')
                          }}
                          disabled={!selectedCharacterId || generatingSection === 'practical'}
                          className="gap-2"
                        >
                          {generatingSection === 'practical' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="char-vehicle-type">Vehicle Type</Label>
                            <Input id="char-vehicle-type" value={newCharVehicleType} onChange={(e) => setNewCharVehicleType(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-vehicle-model">Vehicle Model</Label>
                            <Input id="char-vehicle-model" value={newCharVehicleModel} onChange={(e) => setNewCharVehicleModel(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-vehicle-color">Vehicle Color</Label>
                            <Input id="char-vehicle-color" value={newCharVehicleColor} onChange={(e) => setNewCharVehicleColor(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-vehicle-condition">Vehicle Condition</Label>
                            <Input id="char-vehicle-condition" value={newCharVehicleCondition} onChange={(e) => setNewCharVehicleCondition(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-phone">Phone/Tech Level</Label>
                            <Input id="char-phone" value={newCharPhoneTechLevel} onChange={(e) => setNewCharPhoneTechLevel(e.target.value)} className="bg-input border-border" placeholder="old, latest, doesn't care, obsessed" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-home-type">Home Type</Label>
                            <Input id="char-home-type" value={newCharHomeType} onChange={(e) => setNewCharHomeType(e.target.value)} className="bg-input border-border" placeholder="house, apartment" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-home-neighborhood">Home Neighborhood</Label>
                            <Input id="char-home-neighborhood" value={newCharHomeNeighborhood} onChange={(e) => setNewCharHomeNeighborhood(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-home-condition">Home Condition</Label>
                            <Input id="char-home-condition" value={newCharHomeCondition} onChange={(e) => setNewCharHomeCondition(e.target.value)} className="bg-input border-border" placeholder="neat, messy" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-home-objects">Home Key Objects</Label>
                            <Textarea id="char-home-objects" value={newCharHomeKeyObjects} onChange={(e) => setNewCharHomeKeyObjects(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-routine">Daily Routine</Label>
                            <Textarea id="char-routine" value={newCharDailyRoutine} onChange={(e) => setNewCharDailyRoutine(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="morning/afternoon/night pattern" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-job">Job Schedule</Label>
                            <Textarea id="char-job" value={newCharJobSchedule} onChange={(e) => setNewCharJobSchedule(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="shifts, side hustles, illegal work" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-pets">Pets (comma-separated)</Label>
                            <Input id="char-pets" value={newCharPets} onChange={(e) => setNewCharPets(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-hobbies">Hobbies (comma-separated)</Label>
                            <Input id="char-hobbies" value={newCharHobbies} onChange={(e) => setNewCharHobbies(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-addictions">Addictions/Habits (comma-separated)</Label>
                            <Input id="char-addictions" value={newCharAddictionsHabits} onChange={(e) => setNewCharAddictionsHabits(e.target.value)} className="bg-input border-border" placeholder="coffee, smoking, gym, gambling" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-health">Health Issues</Label>
                            <Textarea id="char-health" value={newCharHealthIssues} onChange={(e) => setNewCharHealthIssues(e.target.value)} className="bg-input border-border min-h-[60px]" placeholder="injuries, allergies, can't swim" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-religion">Religion/Spirituality</Label>
                            <Input id="char-religion" value={newCharReligionSpirituality} onChange={(e) => setNewCharReligionSpirituality(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-political">Political/Social Views</Label>
                            <Input id="char-political" value={newCharPoliticalSocialViews} onChange={(e) => setNewCharPoliticalSocialViews(e.target.value)} className="bg-input border-border" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 8. Dialogue Notes */}
                    <AccordionItem value="dialogue">
                      <div className="flex items-center justify-between pr-4">
                        <AccordionTrigger className="flex-1">8. Dialogue Notes</AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generateSectionContent('dialogue')
                          }}
                          disabled={!selectedCharacterId || generatingSection === 'dialogue'}
                          className="gap-2"
                        >
                          {generatingSection === 'dialogue' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-phrases">Common Phrases or Slang (comma-separated)</Label>
                            <Input id="char-phrases" value={newCharCommonPhrases} onChange={(e) => setNewCharCommonPhrases(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-swearing">Swearing Level</Label>
                            <Input id="char-swearing" value={newCharSwearingLevel} onChange={(e) => setNewCharSwearingLevel(e.target.value)} className="bg-input border-border" placeholder="none, light, heavy" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-speaking">Speaking Style</Label>
                            <Input id="char-speaking" value={newCharSpeakingStyle} onChange={(e) => setNewCharSpeakingStyle(e.target.value)} className="bg-input border-border" placeholder="short and direct, long and poetic, rambly, formal" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-language-switches">Language Switches (format: "Spanish (when angry), French (when flirting)")</Label>
                            <Input id="char-language-switches" value={newCharLanguageSwitches} onChange={(e) => setNewCharLanguageSwitches(e.target.value)} className="bg-input border-border" placeholder="Spanish (when angry), French (when flirting)" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* 9. Extra Notes */}
                    <AccordionItem value="extra">
                      <div className="flex items-center justify-between pr-4">
                        <AccordionTrigger className="flex-1">9. Extra Notes</AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            generateSectionContent('extra')
                          }}
                          disabled={!selectedCharacterId || generatingSection === 'extra'}
                          className="gap-2"
                        >
                          {generatingSection === 'extra' ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="char-motifs">Visual Motifs (comma-separated)</Label>
                            <Input id="char-motifs" value={newCharVisualMotifs} onChange={(e) => setNewCharVisualMotifs(e.target.value)} className="bg-input border-border" placeholder="objects, colors, symbols tied to them" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="char-theme">Theme They Represent</Label>
                            <Input id="char-theme" value={newCharThemeTheyRepresent} onChange={(e) => setNewCharThemeTheyRepresent(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="char-foreshadowing">Foreshadowing Notes</Label>
                            <Textarea id="char-foreshadowing" value={newCharForeshadowingNotes} onChange={(e) => setNewCharForeshadowingNotes(e.target.value)} className="bg-input border-border min-h-[60px]" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => createCharacter()} disabled={isCreatingCharacter || !newCharName.trim()} className="gap-2">
                    {isCreatingCharacter ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCharacterInFormId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingCharacterInFormId ? "Update Character" : "Create Character"}
                  </Button>
                  {editingCharacterInFormId && (
                    <Button variant="outline" onClick={clearForm} disabled={isCreatingCharacter} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {isLoadingCharacters ? "Loading characters..." : `${characters.length} character${characters.length === 1 ? "" : "s"}`}
                  </div>
                  {isLoadingCharacters ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : characters.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No characters yet.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {characters.map((ch) => (
                        <div
                          key={ch.id}
                          className={`p-2 rounded-md text-sm border ${
                            editingCharacterId === ch.id
                              ? 'border-primary/60 ring-2 ring-primary/20 bg-primary/5'
                              : 'border-border cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors'
                          }`}
                          onClick={() => {
                            if (editingCharacterId !== ch.id) {
                              beginEdit(ch)
                            }
                          }}
                        >
                          {editingCharacterId === ch.id ? (
                            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label>Name</Label>
                                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-input border-border" />
                                </div>
                                <div className="space-y-1">
                                  <Label>Archetype</Label>
                                  <Input value={editArchetype} onChange={(e) => setEditArchetype(e.target.value)} className="bg-input border-border" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label>Description</Label>
                                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-input border-border min-h-[60px]" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label>Backstory</Label>
                                  <Textarea value={editBackstory} onChange={(e) => setEditBackstory(e.target.value)} className="bg-input border-border min-h-[60px]" />
                                </div>
                                <div className="space-y-1">
                                  <Label>Goals</Label>
                                  <Textarea value={editGoals} onChange={(e) => setEditGoals(e.target.value)} className="bg-input border-border min-h-[60px]" />
                                </div>
                                <div className="space-y-1">
                                  <Label>Conflicts</Label>
                                  <Textarea value={editConflicts} onChange={(e) => setEditConflicts(e.target.value)} className="bg-input border-border min-h-[60px]" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label>Personality Traits (comma-separated)</Label>
                                  <Input value={editTraits} onChange={(e) => setEditTraits(e.target.value)} className="bg-input border-border" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => saveEdit(ch.id)} disabled={isSavingEdit}>
                                  {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                  Save
                                </Button>
                                <Button variant="outline" size="sm" onClick={cancelEdit}>
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium leading-tight line-clamp-1 flex items-center gap-2">
                                    <span>
                                      {ch.name}{' '}
                                      {ch.archetype ? <span className="text-xs text-muted-foreground">({ch.archetype})</span> : null}
                                    </span>
                                    {editingCharacterId === ch.id && (
                                      <Badge className="text-[10px] h-5 px-1.5 bg-primary/20 text-primary border-primary/30">
                                        Editing
                                      </Badge>
                                    )}
                                  </div>
                                  {ch.description && <div className="text-xs text-muted-foreground line-clamp-1">{ch.description}</div>}
                                  {ch.personality?.traits && (ch.personality as any).traits?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(ch.personality as any).traits.slice(0, 2).map((t: string, i: number) => (
                                        <Badge key={`${ch.id}-t-${i}`} variant="outline" className="text-[10px] px-1 py-0">{t}</Badge>
                                      ))}
                                      {(ch.personality as any).traits.length > 2 && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">+{(ch.personality as any).traits.length - 2}</Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" onClick={() => addRole(ch.name)} title="Add to Casting">
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => beginEdit(ch)} title="Edit">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteCharacter(ch.id)} disabled={isDeletingId === ch.id} title="Delete" className="text-destructive">
                                    {isDeletingId === ch.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => toggleExpanded(ch.id)} title="Expand">
                                    {expandedIds.has(ch.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                              {expandedIds.has(ch.id) && (
                                <div className="text-xs text-muted-foreground space-y-1" onClick={(e) => e.stopPropagation()}>
                                  {ch.backstory && <div><span className="font-medium text-foreground">Backstory:</span> <span className="line-clamp-2">{ch.backstory}</span></div>}
                                  {ch.goals && <div><span className="font-medium text-foreground">Goals:</span> <span className="line-clamp-2">{ch.goals}</span></div>}
                                  {ch.conflicts && <div><span className="font-medium text-foreground">Conflicts:</span> <span className="line-clamp-2">{ch.conflicts}</span></div>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Detected Characters and Casting Roles in a row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="cinema-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ListFilter className="h-4 w-4" />
                    Detected Characters
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Filter characters..."
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="h-8 bg-input border-border"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={missingInRoles.length === 0 || syncing}
                      onClick={syncAllMissingToRoles}
                      className="gap-2"
                    >
                      {syncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Sync All To Casting
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {detectedCharacters.length} unique character{detectedCharacters.length === 1 ? "" : "s"} detected
                  {treatmentId ? " (Treatment + Screenplay)" : " (Screenplay)"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {detectedCharacters.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No characters found in scenes.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {detectedCharacters.map((c) => {
                      const alreadyRole = (castingSettings?.roles_available || []).some(
                        (r) => r.toLowerCase() === c.name.toLowerCase(),
                      )
                      return (
                        <div key={c.name} className="flex items-center justify-between p-2 border border-border rounded-md">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{c.count}</Badge>
                            <span className="truncate max-w-[8rem] sm:max-w-[10rem]">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {alreadyRole ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                In Casting
                              </Badge>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => addRole(c.name)} disabled={syncing} title="Add to Casting">
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => createCharacter(c.name)} disabled={isCreatingCharacter} title="Create Character">
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="cinema-card">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Casting Roles
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {rolesAvailable.length} role{rolesAvailable.length === 1 ? "" : "s"} configured
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="new-character">Add role</Label>
                    <Input
                      id="new-character"
                      placeholder="e.g., Protagonist, Detective Jane"
                      value={newCharacter}
                      onChange={(e) => setNewCharacter(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addNewCharacterAsRole()
                        }
                      }}
                      className="bg-input border-border"
                    />
                  </div>
                  <Button onClick={addNewCharacterAsRole} className="gap-2" disabled={!newCharacter.trim() || syncing}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>

                <Separator />

                {rolesAvailable.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No casting roles yet.</div>
                ) : (
                  <div className="space-y-2">
                    {rolesAvailable.map((role) => (
                      <div key={role} className="flex items-center justify-between">
                        <span>{role}</span>
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                )}

                {projectId && (
                  <div className="pt-2">
                    <Link href={`/casting/${projectId}`}>
                      <Button variant="outline" className="w-full gap-2">
                        Go to Casting
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
          </>
        )}
      </main>
    </div>
  )
}


