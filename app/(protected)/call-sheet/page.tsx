"use client"

import { useEffect, useState } from "react"
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
import { Loader2, FileText, Plus, Edit, Save, X, Trash2, Calendar, Clock, Users, MapPin, Phone } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { CallSheetService, type CallSheet, type CastMember, type CrewMember } from "@/lib/call-sheet-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { useAuthReady } from "@/components/auth-hooks"

export default function CallSheetPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""
  const { user, userId, ready } = useAuthReady()

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [callSheets, setCallSheets] = useState<CallSheet[]>([])
  const [isLoadingSheets, setIsLoadingSheets] = useState(false)
  const [isCreatingSheet, setIsCreatingSheet] = useState(false)
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null)

  // Form fields
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [dayNumber, setDayNumber] = useState("")
  const [productionDay, setProductionDay] = useState("")
  const [locationId, setLocationId] = useState<string>("")
  const [locationName, setLocationName] = useState("")
  const [locationAddress, setLocationAddress] = useState("")
  const [weatherForecast, setWeatherForecast] = useState("")
  const [sunriseTime, setSunriseTime] = useState("")
  const [sunsetTime, setSunsetTime] = useState("")
  const [crewCallTime, setCrewCallTime] = useState("")
  const [castCallTime, setCastCallTime] = useState("")
  const [firstShotTime, setFirstShotTime] = useState("")
  const [wrapTime, setWrapTime] = useState("")
  const [lunchTime, setLunchTime] = useState("")
  const [lunchDuration, setLunchDuration] = useState("60")
  const [sceneNumbers, setSceneNumbers] = useState("")
  const [estimatedPages, setEstimatedPages] = useState("")
  const [equipmentNeeded, setEquipmentNeeded] = useState("")
  const [vehiclesNeeded, setVehiclesNeeded] = useState("")
  const [specialEquipment, setSpecialEquipment] = useState("")
  const [productionNotes, setProductionNotes] = useState("")
  const [specialInstructions, setSpecialInstructions] = useState("")
  const [safetyNotes, setSafetyNotes] = useState("")
  const [parkingInstructions, setParkingInstructions] = useState("")
  const [cateringNotes, setCateringNotes] = useState("")
  const [productionOfficePhone, setProductionOfficePhone] = useState("")
  const [locationManagerPhone, setLocationManagerPhone] = useState("")
  const [emergencyContact, setEmergencyContact] = useState("")
  const [status, setStatus] = useState<string>("draft")

  // Cast and crew arrays
  const [castMembers, setCastMembers] = useState<CastMember[]>([])
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([])

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        // Load locations
        const locs = await LocationsService.getLocations(projectId)
        setLocations(locs)

        // Load call sheets
        setIsLoadingSheets(true)
        const sheets = await CallSheetService.getCallSheets(projectId)
        setCallSheets(sheets)
      } catch (err) {
        console.error("Failed to load call sheet data:", err)
        toast({
          title: "Error",
          description: "Failed to load call sheets. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingSheets(false)
        setLoading(false)
      }
    }
    if (ready && projectId) {
      load()
    }
  }, [projectId, ready, toast])

  // Auto-fill location when selected
  useEffect(() => {
    if (locationId && locations.length > 0) {
      const location = locations.find(l => l.id === locationId)
      if (location) {
        setLocationName(location.name)
        const addressParts = [location.address, location.city, location.state, location.country].filter(Boolean)
        setLocationAddress(addressParts.join(", "))
      }
    }
  }, [locationId, locations])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setEditingSheetId(null)
    clearForm()
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("movie", id)
    } else {
      url.searchParams.delete("movie")
    }
    router.replace(url.toString())
  }

  const clearForm = () => {
    setTitle("")
    setDate("")
    setDayNumber("")
    setProductionDay("")
    setLocationId("")
    setLocationName("")
    setLocationAddress("")
    setWeatherForecast("")
    setSunriseTime("")
    setSunsetTime("")
    setCrewCallTime("")
    setCastCallTime("")
    setFirstShotTime("")
    setWrapTime("")
    setLunchTime("")
    setLunchDuration("60")
    setSceneNumbers("")
    setEstimatedPages("")
    setEquipmentNeeded("")
    setVehiclesNeeded("")
    setSpecialEquipment("")
    setProductionNotes("")
    setSpecialInstructions("")
    setSafetyNotes("")
    setParkingInstructions("")
    setCateringNotes("")
    setProductionOfficePhone("")
    setLocationManagerPhone("")
    setEmergencyContact("")
    setStatus("draft")
    setCastMembers([])
    setCrewMembers([])
    setEditingSheetId(null)
  }

  const loadSheetIntoForm = (sheet: CallSheet) => {
    setEditingSheetId(sheet.id)
    setTitle(sheet.title || "")
    setDate(sheet.date || "")
    setDayNumber(sheet.day_number?.toString() || "")
    setProductionDay(sheet.production_day || "")
    setLocationId(sheet.location_id || "")
    setLocationName(sheet.location_name || "")
    setLocationAddress(sheet.location_address || "")
    setWeatherForecast(sheet.weather_forecast || "")
    setSunriseTime(sheet.sunrise_time || "")
    setSunsetTime(sheet.sunset_time || "")
    setCrewCallTime(sheet.crew_call_time || "")
    setCastCallTime(sheet.cast_call_time || "")
    setFirstShotTime(sheet.first_shot_time || "")
    setWrapTime(sheet.wrap_time || "")
    setLunchTime(sheet.lunch_time || "")
    setLunchDuration(sheet.lunch_duration_minutes?.toString() || "60")
    setSceneNumbers((sheet.scene_numbers || []).join(", "))
    setEstimatedPages(sheet.estimated_pages?.toString() || "")
    setEquipmentNeeded((sheet.equipment_needed || []).join(", "))
    setVehiclesNeeded((sheet.vehicles_needed || []).join(", "))
    setSpecialEquipment(sheet.special_equipment || "")
    setProductionNotes(sheet.production_notes || "")
    setSpecialInstructions(sheet.special_instructions || "")
    setSafetyNotes(sheet.safety_notes || "")
    setParkingInstructions(sheet.parking_instructions || "")
    setCateringNotes(sheet.catering_notes || "")
    setProductionOfficePhone(sheet.production_office_phone || "")
    setLocationManagerPhone(sheet.location_manager_phone || "")
    setEmergencyContact(sheet.emergency_contact || "")
    setStatus(sheet.status || "draft")
    setCastMembers(sheet.cast_members || [])
    setCrewMembers(sheet.crew_members || [])
  }

  const createOrUpdateSheet = async () => {
    if (!projectId) return
    const titleValue = title.trim()
    if (!titleValue) {
      toast({ title: "Title required", description: "Please enter a call sheet title.", variant: "destructive" })
      return
    }
    if (!date) {
      toast({ title: "Date required", description: "Please select a date.", variant: "destructive" })
      return
    }

    try {
      setIsCreatingSheet(true)

      const parseArray = (str: string) => str.split(",").map(s => s.trim()).filter(Boolean)

      const sheetData: any = {
        project_id: projectId,
        title: titleValue,
        date: date,
        day_number: dayNumber ? parseInt(dayNumber) : undefined,
        production_day: productionDay || undefined,
        location_id: locationId || undefined,
        location_name: locationName || undefined,
        location_address: locationAddress || undefined,
        weather_forecast: weatherForecast || undefined,
        sunrise_time: sunriseTime || undefined,
        sunset_time: sunsetTime || undefined,
        crew_call_time: crewCallTime || undefined,
        cast_call_time: castCallTime || undefined,
        first_shot_time: firstShotTime || undefined,
        wrap_time: wrapTime || undefined,
        lunch_time: lunchTime || undefined,
        lunch_duration_minutes: lunchDuration ? parseInt(lunchDuration) : undefined,
        scene_numbers: sceneNumbers ? parseArray(sceneNumbers) : undefined,
        estimated_pages: estimatedPages ? parseFloat(estimatedPages) : undefined,
        equipment_needed: equipmentNeeded ? parseArray(equipmentNeeded) : undefined,
        vehicles_needed: vehiclesNeeded ? parseArray(vehiclesNeeded) : undefined,
        special_equipment: specialEquipment || undefined,
        production_notes: productionNotes || undefined,
        special_instructions: specialInstructions || undefined,
        safety_notes: safetyNotes || undefined,
        parking_instructions: parkingInstructions || undefined,
        catering_notes: cateringNotes || undefined,
        production_office_phone: productionOfficePhone || undefined,
        location_manager_phone: locationManagerPhone || undefined,
        emergency_contact: emergencyContact || undefined,
        status: status || "draft",
        cast_members: castMembers.length > 0 ? castMembers : undefined,
        crew_members: crewMembers.length > 0 ? crewMembers : undefined,
      }

      // Remove undefined values
      Object.keys(sheetData).forEach(key => {
        if (sheetData[key] === undefined) {
          delete sheetData[key]
        }
      })

      if (editingSheetId) {
        const updated = await CallSheetService.updateCallSheet(editingSheetId, sheetData)
        setCallSheets(prev => prev.map(s => s.id === editingSheetId ? updated : s))
        toast({ title: "Call sheet updated", description: `"${updated.title}" saved.` })
      } else {
        const created = await CallSheetService.createCallSheet(sheetData)
        setCallSheets([created, ...callSheets])
        toast({ title: "Call sheet created", description: `"${created.title}" added.` })
      }

      clearForm()
    } catch (err) {
      console.error('Create/update call sheet failed:', err)
      toast({
        title: "Error",
        description: editingSheetId ? "Failed to update call sheet." : "Failed to create call sheet.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingSheet(false)
    }
  }

  const deleteSheet = async (id: string) => {
    if (!confirm("Delete this call sheet? This cannot be undone.")) return
    try {
      await CallSheetService.deleteCallSheet(id)
      setCallSheets(prev => prev.filter(s => s.id !== id))
      if (editingSheetId === id) {
        clearForm()
      }
      toast({ title: "Deleted", description: "Call sheet removed." })
    } catch (e) {
      console.error('Delete call sheet failed:', e)
      toast({ title: "Error", description: "Failed to delete call sheet.", variant: "destructive" })
    }
  }

  const addCastMember = () => {
    setCastMembers([...castMembers, { name: "", role: "", character: "", call_time: "" }])
  }

  const updateCastMember = (index: number, field: keyof CastMember, value: string) => {
    const updated = [...castMembers]
    updated[index] = { ...updated[index], [field]: value }
    setCastMembers(updated)
  }

  const removeCastMember = (index: number) => {
    setCastMembers(castMembers.filter((_, i) => i !== index))
  }

  const addCrewMember = () => {
    setCrewMembers([...crewMembers, { name: "", role: "", department: "", call_time: "" }])
  }

  const updateCrewMember = (index: number, field: keyof CrewMember, value: string) => {
    const updated = [...crewMembers]
    updated[index] = { ...updated[index], [field]: value }
    setCrewMembers(updated)
  }

  const removeCrewMember = (index: number) => {
    setCrewMembers(crewMembers.filter((_, i) => i !== index))
  }

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'published': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'archived': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent">
              Call Sheets
            </h1>
            <p className="text-muted-foreground">
              Create and manage daily production call sheets for your shoot.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie to manage call sheets"
          />
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a movie to view and manage call sheets.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading call sheets...
          </div>
        ) : (
          <>
            {/* Create/Edit Form */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <CardTitle>
                  {editingSheetId ? "Edit Call Sheet" : "Create New Call Sheet"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Day 1 - Main Street Coffee Shop"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="day-number">Day Number</Label>
                      <Input
                        id="day-number"
                        type="number"
                        value={dayNumber}
                        onChange={(e) => setDayNumber(e.target.value)}
                        className="bg-input border-border"
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="production-day">Production Day</Label>
                      <Input
                        id="production-day"
                        value={productionDay}
                        onChange={(e) => setProductionDay(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Monday, Day 1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={status || "__draft__"} onValueChange={(value) => setStatus(value === "__draft__" ? "draft" : value)}>
                        <SelectTrigger id="status" className="bg-input border-border">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Location */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Location</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location-select">Location</Label>
                      <Select value={locationId || "__none__"} onValueChange={(value) => setLocationId(value === "__none__" ? "" : value)}>
                        <SelectTrigger id="location-select" className="bg-input border-border">
                          <SelectValue placeholder="Select location (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-name">Location Name</Label>
                      <Input
                        id="location-name"
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Main Street Coffee Shop"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="location-address">Location Address</Label>
                      <Input
                        id="location-address"
                        value={locationAddress}
                        onChange={(e) => setLocationAddress(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Full address"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Schedule */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Schedule</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="crew-call">Crew Call Time</Label>
                      <Input
                        id="crew-call"
                        type="time"
                        value={crewCallTime}
                        onChange={(e) => setCrewCallTime(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cast-call">Cast Call Time</Label>
                      <Input
                        id="cast-call"
                        type="time"
                        value={castCallTime}
                        onChange={(e) => setCastCallTime(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first-shot">First Shot Time</Label>
                      <Input
                        id="first-shot"
                        type="time"
                        value={firstShotTime}
                        onChange={(e) => setFirstShotTime(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wrap">Wrap Time</Label>
                      <Input
                        id="wrap"
                        type="time"
                        value={wrapTime}
                        onChange={(e) => setWrapTime(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lunch">Lunch Time</Label>
                      <Input
                        id="lunch"
                        type="time"
                        value={lunchTime}
                        onChange={(e) => setLunchTime(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lunch-duration">Lunch Duration (minutes)</Label>
                      <Input
                        id="lunch-duration"
                        type="number"
                        value={lunchDuration}
                        onChange={(e) => setLunchDuration(e.target.value)}
                        className="bg-input border-border"
                        placeholder="60"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Weather */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Weather & Sun</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="weather">Weather Forecast</Label>
                      <Input
                        id="weather"
                        value={weatherForecast}
                        onChange={(e) => setWeatherForecast(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Sunny, 72°F"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sunrise">Sunrise Time</Label>
                      <Input
                        id="sunrise"
                        type="time"
                        value={sunriseTime}
                        onChange={(e) => setSunriseTime(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sunset">Sunset Time</Label>
                      <Input
                        id="sunset"
                        type="time"
                        value={sunsetTime}
                        onChange={(e) => setSunsetTime(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Scenes */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Scenes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scene-numbers">Scene Numbers (comma-separated)</Label>
                      <Input
                        id="scene-numbers"
                        value={sceneNumbers}
                        onChange={(e) => setSceneNumbers(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., 1, 2A, 3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estimated-pages">Estimated Pages</Label>
                      <Input
                        id="estimated-pages"
                        type="number"
                        step="0.1"
                        value={estimatedPages}
                        onChange={(e) => setEstimatedPages(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., 5.5"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Cast */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Cast</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addCastMember} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Cast Member
                    </Button>
                  </div>
                  {castMembers.map((member, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border border-border rounded-lg">
                      <Input
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => updateCastMember(index, 'name', e.target.value)}
                        className="bg-input border-border"
                      />
                      <Input
                        placeholder="Character"
                        value={member.character}
                        onChange={(e) => updateCastMember(index, 'character', e.target.value)}
                        className="bg-input border-border"
                      />
                      <Input
                        type="time"
                        placeholder="Call Time"
                        value={member.call_time}
                        onChange={(e) => updateCastMember(index, 'call_time', e.target.value)}
                        className="bg-input border-border"
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Phone (optional)"
                          value={member.phone}
                          onChange={(e) => updateCastMember(index, 'phone', e.target.value)}
                          className="bg-input border-border flex-1"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeCastMember(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {castMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No cast members added. Click "Add Cast Member" to add.</p>
                  )}
                </div>

                <Separator />

                {/* Crew */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Crew</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addCrewMember} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Crew Member
                    </Button>
                  </div>
                  {crewMembers.map((member, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border border-border rounded-lg">
                      <Input
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => updateCrewMember(index, 'name', e.target.value)}
                        className="bg-input border-border"
                      />
                      <Input
                        placeholder="Role"
                        value={member.role}
                        onChange={(e) => updateCrewMember(index, 'role', e.target.value)}
                        className="bg-input border-border"
                      />
                      <Input
                        type="time"
                        placeholder="Call Time"
                        value={member.call_time}
                        onChange={(e) => updateCrewMember(index, 'call_time', e.target.value)}
                        className="bg-input border-border"
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Phone (optional)"
                          value={member.phone}
                          onChange={(e) => updateCrewMember(index, 'phone', e.target.value)}
                          className="bg-input border-border flex-1"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeCrewMember(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {crewMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No crew members added. Click "Add Crew Member" to add.</p>
                  )}
                </div>

                <Separator />

                {/* Equipment */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Equipment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="equipment">Equipment Needed (comma-separated)</Label>
                      <Input
                        id="equipment"
                        value={equipmentNeeded}
                        onChange={(e) => setEquipmentNeeded(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Camera, Tripod, Lights"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicles">Vehicles Needed (comma-separated)</Label>
                      <Input
                        id="vehicles"
                        value={vehiclesNeeded}
                        onChange={(e) => setVehiclesNeeded(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Van, Generator Truck"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="special-equipment">Special Equipment</Label>
                      <Textarea
                        id="special-equipment"
                        value={specialEquipment}
                        onChange={(e) => setSpecialEquipment(e.target.value)}
                        className="bg-input border-border min-h-[60px]"
                        placeholder="Special equipment or requirements..."
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Notes */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Notes & Instructions</h3>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="production-notes">Production Notes</Label>
                      <Textarea
                        id="production-notes"
                        value={productionNotes}
                        onChange={(e) => setProductionNotes(e.target.value)}
                        className="bg-input border-border min-h-[80px]"
                        placeholder="General production notes..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="special-instructions">Special Instructions</Label>
                      <Textarea
                        id="special-instructions"
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        className="bg-input border-border min-h-[60px]"
                        placeholder="Special instructions for cast and crew..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="safety-notes">Safety Notes</Label>
                      <Textarea
                        id="safety-notes"
                        value={safetyNotes}
                        onChange={(e) => setSafetyNotes(e.target.value)}
                        className="bg-input border-border min-h-[60px]"
                        placeholder="Safety considerations and warnings..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parking">Parking Instructions</Label>
                      <Textarea
                        id="parking"
                        value={parkingInstructions}
                        onChange={(e) => setParkingInstructions(e.target.value)}
                        className="bg-input border-border min-h-[60px]"
                        placeholder="Parking locations and instructions..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="catering">Catering Notes</Label>
                      <Textarea
                        id="catering"
                        value={cateringNotes}
                        onChange={(e) => setCateringNotes(e.target.value)}
                        className="bg-input border-border min-h-[60px]"
                        placeholder="Catering information and meal times..."
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="production-phone">Production Office Phone</Label>
                      <Input
                        id="production-phone"
                        type="tel"
                        value={productionOfficePhone}
                        onChange={(e) => setProductionOfficePhone(e.target.value)}
                        className="bg-input border-border"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-manager-phone">Location Manager Phone</Label>
                      <Input
                        id="location-manager-phone"
                        type="tel"
                        value={locationManagerPhone}
                        onChange={(e) => setLocationManagerPhone(e.target.value)}
                        className="bg-input border-border"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergency-contact">Emergency Contact</Label>
                      <Input
                        id="emergency-contact"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Name and phone number"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={createOrUpdateSheet}
                    disabled={isCreatingSheet || !title.trim() || !date}
                    className="gap-2"
                  >
                    {isCreatingSheet ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingSheetId ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingSheetId ? "Update Call Sheet" : "Create Call Sheet"}
                  </Button>
                  {editingSheetId && (
                    <Button variant="outline" onClick={clearForm} disabled={isCreatingSheet} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Call Sheets List */}
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Call Sheets
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isLoadingSheets
                    ? "Loading..."
                    : `${callSheets.length} call sheet${callSheets.length === 1 ? "" : "s"}`}
                </p>
              </CardHeader>
              <CardContent>
                {isLoadingSheets ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading call sheets...
                  </div>
                ) : callSheets.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No call sheets yet. Create your first call sheet above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {callSheets.map((sheet) => (
                      <div
                        key={sheet.id}
                        className="p-4 border border-border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg">{sheet.title}</h3>
                              <Badge className={getStatusColor(sheet.status)}>
                                {sheet.status || 'draft'}
                              </Badge>
                              {sheet.date && (
                                <Badge variant="outline" className="gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(sheet.date)}
                                </Badge>
                              )}
                              {sheet.day_number && (
                                <Badge variant="outline">Day {sheet.day_number}</Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              {sheet.location_name && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Location: </span>
                                  <span className="font-medium">{sheet.location_name}</span>
                                </div>
                              )}
                              {sheet.crew_call_time && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Crew Call: </span>
                                  <span className="font-medium">{sheet.crew_call_time}</span>
                                </div>
                              )}
                              {sheet.cast_call_time && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Cast Call: </span>
                                  <span className="font-medium">{sheet.cast_call_time}</span>
                                </div>
                              )}
                              {sheet.scene_numbers && sheet.scene_numbers.length > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Scenes: </span>
                                  <span className="font-medium">{sheet.scene_numbers.join(", ")}</span>
                                </div>
                              )}
                            </div>

                            {sheet.production_notes && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{sheet.production_notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => loadSheetIntoForm(sheet)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteSheet(sheet.id)}
                              title="Delete"
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

