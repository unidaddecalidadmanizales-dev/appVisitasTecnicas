import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'

export type Institucion = Tables<'instituciones'>

export async function getInstituciones(): Promise<Institucion[]> {
  const { data, error } = await supabase
    .from('instituciones')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data
}

export async function getInstitucion(id: string): Promise<Institucion> {
  const { data, error } = await supabase
    .from('instituciones')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function crearInstitucion(
  input: TablesInsert<'instituciones'>,
): Promise<Institucion> {
  const { data, error } = await supabase
    .from('instituciones')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarInstitucion(
  id: string,
  patch: TablesUpdate<'instituciones'>,
): Promise<Institucion> {
  const { data, error } = await supabase
    .from('instituciones')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
