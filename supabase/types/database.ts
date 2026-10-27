export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      antt_coeficiente: {
        Row: {
          cc: number
          ccd: number
          eixos: number
          portaria: string
          tipo_carga: Database["public"]["Enums"]["tipo_carga_antt"]
          vigencia_inicio: string
        }
        ComputedFields: never
        Insert: {
          cc: number
          ccd: number
          eixos: number
          portaria: string
          tipo_carga: Database["public"]["Enums"]["tipo_carga_antt"]
          vigencia_inicio: string
        }
        Update: {
          cc?: number
          ccd?: number
          eixos?: number
          portaria?: string
          tipo_carga?: Database["public"]["Enums"]["tipo_carga_antt"]
          vigencia_inicio?: string
        }
        Relationships: []
      }
      arquivo: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mime: string | null
          nome_original: string | null
          numero: string | null
          pessoa_id: string | null
          restrito: boolean
          storage_path: string
          tamanho_bytes: number | null
          tipo_arquivo_id: number
          updated_at: string
          updated_by: string | null
          validade: string | null
          validado_em: string | null
          validado_por: string | null
          veiculo_id: string | null
          viagem_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime?: string | null
          nome_original?: string | null
          numero?: string | null
          pessoa_id?: string | null
          restrito?: boolean
          storage_path: string
          tamanho_bytes?: number | null
          tipo_arquivo_id: number
          updated_at?: string
          updated_by?: string | null
          validade?: string | null
          validado_em?: string | null
          validado_por?: string | null
          veiculo_id?: string | null
          viagem_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime?: string | null
          nome_original?: string | null
          numero?: string | null
          pessoa_id?: string | null
          restrito?: boolean
          storage_path?: string
          tamanho_bytes?: number | null
          tipo_arquivo_id?: number
          updated_at?: string
          updated_by?: string | null
          validade?: string | null
          validado_em?: string | null
          validado_por?: string | null
          veiculo_id?: string | null
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arquivo_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivo_tipo_arquivo_id_fkey"
            columns: ["tipo_arquivo_id"]
            isOneToOne: false
            referencedRelation: "tipo_arquivo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivo_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivo_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_quadro"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "arquivo_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_viagem_planejada"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "arquivo_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          dados_antes: Json | null
          dados_depois: Json | null
          em: string
          id: number
          registro_id: string
          tabela: string
          usuario_id: string | null
        }
        ComputedFields: never
        Insert: {
          acao: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          em?: string
          id?: never
          registro_id: string
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          em?: string
          id?: never
          registro_id?: string
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      banco: {
        Row: {
          codigo: string
          nome: string
        }
        ComputedFields: never
        Insert: {
          codigo: string
          nome: string
        }
        Update: {
          codigo?: string
          nome?: string
        }
        Relationships: []
      }
      centro_custo: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          created_by: string | null
          id: number
          nome: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          id?: number
          nome: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          id?: number
          nome?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cliente: {
        Row: {
          condicao_faturamento: Database["public"]["Enums"]["condicao_faturamento"]
          created_at: string
          created_by: string | null
          email_cobranca: string | null
          email_xml: string | null
          exige_gr: boolean
          exige_sm: boolean
          exigencias: string | null
          gerenciadora: string | null
          pessoa_id: string
          tolerancia_quebra_pct: number
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          condicao_faturamento?: Database["public"]["Enums"]["condicao_faturamento"]
          created_at?: string
          created_by?: string | null
          email_cobranca?: string | null
          email_xml?: string | null
          exige_gr?: boolean
          exige_sm?: boolean
          exigencias?: string | null
          gerenciadora?: string | null
          pessoa_id: string
          tolerancia_quebra_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          condicao_faturamento?: Database["public"]["Enums"]["condicao_faturamento"]
          created_at?: string
          created_by?: string | null
          email_cobranca?: string | null
          email_xml?: string | null
          exige_gr?: boolean
          exige_sm?: boolean
          exigencias?: string | null
          gerenciadora?: string | null
          pessoa_id?: string
          tolerancia_quebra_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: true
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      conjunto: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cavalo_id: string
          created_at: string
          created_by: string | null
          fim: string | null
          id: string
          inicio: string
          motorista_id: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cavalo_id: string
          created_at?: string
          created_by?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          motorista_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cavalo_id?: string
          created_at?: string
          created_by?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          motorista_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conjunto_cavalo_id_fkey"
            columns: ["cavalo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conjunto_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "conjunto_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      conjunto_item: {
        Row: {
          conjunto_id: string
          posicao: number
          veiculo_id: string
        }
        ComputedFields: never
        Insert: {
          conjunto_id: string
          posicao: number
          veiculo_id: string
        }
        Update: {
          conjunto_id?: string
          posicao?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conjunto_item_conjunto_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "conjunto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conjunto_item_conjunto_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "v_conjunto_capacidade"
            referencedColumns: ["conjunto_id"]
          },
          {
            foreignKeyName: "conjunto_item_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_config: {
        Row: {
          id: number
          parcelas_frete_ativas: boolean
          parcelas_frete_mudado_em: string | null
          parcelas_frete_mudado_por: string | null
        }
        ComputedFields: never
        Insert: {
          id?: number
          parcelas_frete_ativas?: boolean
          parcelas_frete_mudado_em?: string | null
          parcelas_frete_mudado_por?: string | null
        }
        Update: {
          id?: number
          parcelas_frete_ativas?: boolean
          parcelas_frete_mudado_em?: string | null
          parcelas_frete_mudado_por?: string | null
        }
        Relationships: []
      }
      fin_conta: {
        Row: {
          agencia: string
          apelido: string | null
          banco: string
          created_at: string
          created_by: string | null
          id: string
          numero: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          agencia?: string
          apelido?: string | null
          banco: string
          created_at?: string
          created_by?: string | null
          id?: string
          numero: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agencia?: string
          apelido?: string | null
          banco?: string
          created_at?: string
          created_by?: string | null
          id?: string
          numero?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fin_importacao: {
        Row: {
          conta_id: string
          created_at: string
          created_by: string | null
          fim: string | null
          id: string
          inicio: string | null
          nome_arquivo: string
          novos: number
          saldo: number | null
          saldo_em: string | null
          total: number
        }
        ComputedFields: never
        Insert: {
          conta_id: string
          created_at?: string
          created_by?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          nome_arquivo: string
          novos?: number
          saldo?: number | null
          saldo_em?: string | null
          total?: number
        }
        Update: {
          conta_id?: string
          created_at?: string
          created_by?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          nome_arquivo?: string
          novos?: number
          saldo?: number | null
          saldo_em?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_importacao_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_conta"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_lancamento: {
        Row: {
          categoria: Database["public"]["Enums"]["fin_categoria"] | null
          chave: string
          classificado_em: string | null
          classificado_por: string | null
          conta_id: string | null
          created_at: string
          data: string
          descricao: string
          fitid: string | null
          id: string
          importacao_id: string | null
          observacao: string | null
          updated_at: string
          updated_by: string | null
          valor: number
        }
        ComputedFields: never
        Insert: {
          categoria?: Database["public"]["Enums"]["fin_categoria"] | null
          chave: string
          classificado_em?: string | null
          classificado_por?: string | null
          conta_id?: string | null
          created_at?: string
          data: string
          descricao: string
          fitid?: string | null
          id?: string
          importacao_id?: string | null
          observacao?: string | null
          updated_at?: string
          updated_by?: string | null
          valor: number
        }
        Update: {
          categoria?: Database["public"]["Enums"]["fin_categoria"] | null
          chave?: string
          classificado_em?: string | null
          classificado_por?: string | null
          conta_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          fitid?: string | null
          id?: string
          importacao_id?: string | null
          observacao?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_lancamento_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamento_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "fin_importacao"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_pagar: {
        Row: {
          antecipacao_liberada_em: string | null
          antecipacao_liberada_por: string | null
          antecipacao_motivo: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          cancelado_automatico: boolean
          cancelado_em: string | null
          cancelado_por: string | null
          cancelamento_motivo: string | null
          centro_custo_id: number
          competencia: string | null
          conta_id: string | null
          created_at: string
          descricao: string
          editado_por: string | null
          favorecido_id: string | null
          favorecido_nome: string
          forma: Database["public"]["Enums"]["fin_forma"]
          id: string
          lancado_por: string | null
          numero: number
          observacao: string | null
          origem: string
          pago_em: string | null
          pago_por: string | null
          pago_registrado_em: string | null
          parte_pedagio: number
          parte_retencao: number
          plano_id: number
          updated_at: string
          updated_by: string | null
          valor: number
          vencimento: string
          viagem_id: string | null
        }
        ComputedFields: never
        Insert: {
          antecipacao_liberada_em?: string | null
          antecipacao_liberada_por?: string | null
          antecipacao_motivo?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          cancelado_automatico?: boolean
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          centro_custo_id: number
          competencia?: string | null
          conta_id?: string | null
          created_at?: string
          descricao: string
          editado_por?: string | null
          favorecido_id?: string | null
          favorecido_nome: string
          forma: Database["public"]["Enums"]["fin_forma"]
          id?: string
          lancado_por?: string | null
          numero?: never
          observacao?: string | null
          origem?: string
          pago_em?: string | null
          pago_por?: string | null
          pago_registrado_em?: string | null
          parte_pedagio?: number
          parte_retencao?: number
          plano_id: number
          updated_at?: string
          updated_by?: string | null
          valor: number
          vencimento: string
          viagem_id?: string | null
        }
        Update: {
          antecipacao_liberada_em?: string | null
          antecipacao_liberada_por?: string | null
          antecipacao_motivo?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          cancelado_automatico?: boolean
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          centro_custo_id?: number
          competencia?: string | null
          conta_id?: string | null
          created_at?: string
          descricao?: string
          editado_por?: string | null
          favorecido_id?: string | null
          favorecido_nome?: string
          forma?: Database["public"]["Enums"]["fin_forma"]
          id?: string
          lancado_por?: string | null
          numero?: never
          observacao?: string | null
          origem?: string
          pago_em?: string | null
          pago_por?: string | null
          pago_registrado_em?: string | null
          parte_pedagio?: number
          parte_retencao?: number
          plano_id?: number
          updated_at?: string
          updated_by?: string | null
          valor?: number
          vencimento?: string
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_pagar_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pagar_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pagar_favorecido_id_fkey"
            columns: ["favorecido_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pagar_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pagar_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_quadro"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "fin_pagar_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_viagem_planejada"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "fin_pagar_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_plano_conta: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          entrada: boolean
          grupo: Database["public"]["Enums"]["fin_grupo_plano"]
          id: number
          nome: string
          ordem: number
          saida: boolean
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          entrada?: boolean
          grupo: Database["public"]["Enums"]["fin_grupo_plano"]
          id?: number
          nome: string
          ordem?: number
          saida?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          entrada?: boolean
          grupo?: Database["public"]["Enums"]["fin_grupo_plano"]
          id?: number
          nome?: string
          ordem?: number
          saida?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fin_receber: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          cancelamento_motivo: string | null
          centro_custo_id: number
          cliente_id: string
          conta_id: string | null
          created_at: string
          editado_por: string | null
          forma: Database["public"]["Enums"]["fin_forma"]
          id: string
          lancado_por: string | null
          numero: number
          observacao: string | null
          origem: string
          plano_id: number
          recebido_em: string | null
          recebido_por: string | null
          recebido_registrado_em: string | null
          titulo: string
          updated_at: string
          updated_by: string | null
          valor: number
          vencimento: string
          viagem_id: string | null
        }
        ComputedFields: never
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          centro_custo_id: number
          cliente_id: string
          conta_id?: string | null
          created_at?: string
          editado_por?: string | null
          forma?: Database["public"]["Enums"]["fin_forma"]
          id?: string
          lancado_por?: string | null
          numero?: never
          observacao?: string | null
          origem?: string
          plano_id: number
          recebido_em?: string | null
          recebido_por?: string | null
          recebido_registrado_em?: string | null
          titulo: string
          updated_at?: string
          updated_by?: string | null
          valor: number
          vencimento: string
          viagem_id?: string | null
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          centro_custo_id?: number
          cliente_id?: string
          conta_id?: string | null
          created_at?: string
          editado_por?: string | null
          forma?: Database["public"]["Enums"]["fin_forma"]
          id?: string
          lancado_por?: string | null
          numero?: never
          observacao?: string | null
          origem?: string
          plano_id?: number
          recebido_em?: string | null
          recebido_por?: string | null
          recebido_registrado_em?: string | null
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
          vencimento?: string
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_receber_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "fin_receber_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_receber_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_receber_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_quadro"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "fin_receber_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_viagem_planejada"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "fin_receber_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_regra: {
        Row: {
          categoria: Database["public"]["Enums"]["fin_categoria"]
          chave: string
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          categoria: Database["public"]["Enums"]["fin_categoria"]
          chave: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["fin_categoria"]
          chave?: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fiscal_guia: {
        Row: {
          competencia: string
          gerada_em: string
          gerada_por: string | null
          id: string
          paga_em: string | null
          tipo: Database["public"]["Enums"]["fiscal_tipo_guia"]
          updated_at: string
          updated_by: string | null
          valor: number
          vencimento: string
        }
        ComputedFields: never
        Insert: {
          competencia: string
          gerada_em?: string
          gerada_por?: string | null
          id?: string
          paga_em?: string | null
          tipo: Database["public"]["Enums"]["fiscal_tipo_guia"]
          updated_at?: string
          updated_by?: string | null
          valor: number
          vencimento: string
        }
        Update: {
          competencia?: string
          gerada_em?: string
          gerada_por?: string | null
          id?: string
          paga_em?: string | null
          tipo?: Database["public"]["Enums"]["fiscal_tipo_guia"]
          updated_at?: string
          updated_by?: string | null
          valor?: number
          vencimento?: string
        }
        Relationships: []
      }
      marca_veiculo: {
        Row: {
          id: number
          nome: string
        }
        ComputedFields: never
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      motorista: {
        Row: {
          cnh_categoria: Database["public"]["Enums"]["categoria_cnh"] | null
          cnh_cidade_emissao: string | null
          cnh_emissao: string | null
          cnh_formulario: string | null
          cnh_observacao: string | null
          cnh_primeira_habilitacao: string | null
          cnh_registro: string | null
          cnh_renach: string | null
          cnh_seguranca: string | null
          cnh_uf: Database["public"]["Enums"]["uf"] | null
          cnh_validade: string | null
          created_at: string
          created_by: string | null
          dt_qualificacao_gmp: string | null
          gr_consulta_em: string | null
          gr_gerenciadora: string | null
          gr_protocolo: string | null
          gr_validade: string | null
          pessoa_id: string
          qualificado_gmp: boolean | null
          radio: string | null
          situacao_cadastro: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_gr: Database["public"]["Enums"]["situacao_gr"]
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          cnh_categoria?: Database["public"]["Enums"]["categoria_cnh"] | null
          cnh_cidade_emissao?: string | null
          cnh_emissao?: string | null
          cnh_formulario?: string | null
          cnh_observacao?: string | null
          cnh_primeira_habilitacao?: string | null
          cnh_registro?: string | null
          cnh_renach?: string | null
          cnh_seguranca?: string | null
          cnh_uf?: Database["public"]["Enums"]["uf"] | null
          cnh_validade?: string | null
          created_at?: string
          created_by?: string | null
          dt_qualificacao_gmp?: string | null
          gr_consulta_em?: string | null
          gr_gerenciadora?: string | null
          gr_protocolo?: string | null
          gr_validade?: string | null
          pessoa_id: string
          qualificado_gmp?: boolean | null
          radio?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_gr?: Database["public"]["Enums"]["situacao_gr"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cnh_categoria?: Database["public"]["Enums"]["categoria_cnh"] | null
          cnh_cidade_emissao?: string | null
          cnh_emissao?: string | null
          cnh_formulario?: string | null
          cnh_observacao?: string | null
          cnh_primeira_habilitacao?: string | null
          cnh_registro?: string | null
          cnh_renach?: string | null
          cnh_seguranca?: string | null
          cnh_uf?: Database["public"]["Enums"]["uf"] | null
          cnh_validade?: string | null
          created_at?: string
          created_by?: string | null
          dt_qualificacao_gmp?: string | null
          gr_consulta_em?: string | null
          gr_gerenciadora?: string | null
          gr_protocolo?: string | null
          gr_validade?: string | null
          pessoa_id?: string
          qualificado_gmp?: boolean | null
          radio?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_gr?: Database["public"]["Enums"]["situacao_gr"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorista_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: true
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      motorista_disponibilidade: {
        Row: {
          cidade: string
          created_at: string
          created_by: string | null
          id: string
          latitude: number
          livre_ate: string
          livre_desde: string
          longitude: number
          motorista_id: string
          observacao: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          cidade: string
          created_at?: string
          created_by?: string | null
          id?: string
          latitude: number
          livre_ate?: string
          livre_desde?: string
          longitude: number
          motorista_id: string
          observacao?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cidade?: string
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number
          livre_ate?: string
          livre_desde?: string
          longitude?: number
          motorista_id?: string
          observacao?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorista_disponibilidade_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "motorista_disponibilidade_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      motorista_referencia: {
        Row: {
          created_at: string
          created_by: string | null
          dt_referencia: string | null
          id: string
          motorista_id: string
          nome: string
          observacao: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_referencia"]
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          dt_referencia?: string | null
          id?: string
          motorista_id: string
          nome: string
          observacao?: string | null
          telefone?: string | null
          tipo: Database["public"]["Enums"]["tipo_referencia"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dt_referencia?: string | null
          id?: string
          motorista_id?: string
          nome?: string
          observacao?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_referencia"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorista_referencia_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "motorista_referencia_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      negociacao_frete: {
        Row: {
          conjunto_id: string | null
          created_at: string
          created_by: string | null
          cte_em: string | null
          cte_numero: string | null
          destino: string
          eixos: number
          frete_cliente_t: number | null
          frete_motorista: number
          id: string
          km: number
          motivo: string | null
          motorista_id: string
          origem: string
          pedagio: number
          pedido_id: string | null
          peso_kg: number
          piso: number
          respondida_em: string | null
          situacao: Database["public"]["Enums"]["situacao_negociacao"]
          tipo_carga: Database["public"]["Enums"]["tipo_carga_antt"]
          updated_at: string
          updated_by: string | null
          valor_mercadoria_t: number | null
          valor_pedido: number | null
          viagem_id: string | null
        }
        ComputedFields: never
        Insert: {
          conjunto_id?: string | null
          created_at?: string
          created_by?: string | null
          cte_em?: string | null
          cte_numero?: string | null
          destino: string
          eixos: number
          frete_cliente_t?: number | null
          frete_motorista: number
          id?: string
          km: number
          motivo?: string | null
          motorista_id: string
          origem: string
          pedagio?: number
          pedido_id?: string | null
          peso_kg: number
          piso: number
          respondida_em?: string | null
          situacao?: Database["public"]["Enums"]["situacao_negociacao"]
          tipo_carga: Database["public"]["Enums"]["tipo_carga_antt"]
          updated_at?: string
          updated_by?: string | null
          valor_mercadoria_t?: number | null
          valor_pedido?: number | null
          viagem_id?: string | null
        }
        Update: {
          conjunto_id?: string | null
          created_at?: string
          created_by?: string | null
          cte_em?: string | null
          cte_numero?: string | null
          destino?: string
          eixos?: number
          frete_cliente_t?: number | null
          frete_motorista?: number
          id?: string
          km?: number
          motivo?: string | null
          motorista_id?: string
          origem?: string
          pedagio?: number
          pedido_id?: string | null
          peso_kg?: number
          piso?: number
          respondida_em?: string | null
          situacao?: Database["public"]["Enums"]["situacao_negociacao"]
          tipo_carga?: Database["public"]["Enums"]["tipo_carga_antt"]
          updated_at?: string
          updated_by?: string | null
          valor_mercadoria_t?: number | null
          valor_pedido?: number | null
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negociacao_frete_conjunto_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "conjunto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negociacao_frete_conjunto_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "v_conjunto_capacidade"
            referencedColumns: ["conjunto_id"]
          },
          {
            foreignKeyName: "negociacao_frete_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "negociacao_frete_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "negociacao_frete_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negociacao_frete_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_saldo"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "negociacao_frete_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_quadro"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "negociacao_frete_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_viagem_planejada"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "negociacao_frete_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
      negociacao_resultado: {
        Row: {
          margem_liquida: number
          negociacao_id: string
          resultado_liquido: number
        }
        ComputedFields: never
        Insert: {
          margem_liquida: number
          negociacao_id: string
          resultado_liquido: number
        }
        Update: {
          margem_liquida?: number
          negociacao_id?: string
          resultado_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "negociacao_resultado_negociacao_id_fkey"
            columns: ["negociacao_id"]
            isOneToOne: true
            referencedRelation: "negociacao_frete"
            referencedColumns: ["id"]
          },
        ]
      }
      operadora_tag: {
        Row: {
          id: number
          nome: string
        }
        ComputedFields: never
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      parametro_fiscal: {
        Row: {
          desconto_duplicata: number
          irpj_csll: number
          observacao: string | null
          pan_card_pct: number
          pan_card_transferencia: number
          pan_card_transferencias: number
          pis_cofins: number
          seguro_rcdc: number
          seguro_rctrc: number
          vigencia_inicio: string
        }
        ComputedFields: never
        Insert: {
          desconto_duplicata: number
          irpj_csll: number
          observacao?: string | null
          pan_card_pct: number
          pan_card_transferencia: number
          pan_card_transferencias: number
          pis_cofins: number
          seguro_rcdc: number
          seguro_rctrc: number
          vigencia_inicio: string
        }
        Update: {
          desconto_duplicata?: number
          irpj_csll?: number
          observacao?: string | null
          pan_card_pct?: number
          pan_card_transferencia?: number
          pan_card_transferencias?: number
          pis_cofins?: number
          seguro_rcdc?: number
          seguro_rctrc?: number
          vigencia_inicio?: string
        }
        Relationships: []
      }
      parametro_operacional: {
        Row: {
          espera_gratis_h: number
          estadia_por_th: number
          observacao: string | null
          repasse_estadia_pct: number
          vigencia_inicio: string
        }
        ComputedFields: never
        Insert: {
          espera_gratis_h: number
          estadia_por_th: number
          observacao?: string | null
          repasse_estadia_pct: number
          vigencia_inicio: string
        }
        Update: {
          espera_gratis_h?: number
          estadia_por_th?: number
          observacao?: string | null
          repasse_estadia_pct?: number
          vigencia_inicio?: string
        }
        Relationships: []
      }
      pedido: {
        Row: {
          coleta_prevista: string | null
          created_at: string
          created_by: string | null
          destinatario_id: string
          entrega_prevista: string | null
          frete_empresa_origem: Database["public"]["Enums"]["origem_frete"]
          frete_empresa_tipo: Database["public"]["Enums"]["tipo_tarifa"]
          frete_empresa_valor: number
          id: string
          local_coleta_id: string
          local_descarga_id: string
          numero: number
          observacao: string | null
          peso_total_kg: number
          produto: string
          remetente_id: string
          situacao: Database["public"]["Enums"]["situacao_pedido"]
          tipo_carga_antt: Database["public"]["Enums"]["tipo_carga_antt"]
          tomador_id: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          coleta_prevista?: string | null
          created_at?: string
          created_by?: string | null
          destinatario_id: string
          entrega_prevista?: string | null
          frete_empresa_origem?: Database["public"]["Enums"]["origem_frete"]
          frete_empresa_tipo?: Database["public"]["Enums"]["tipo_tarifa"]
          frete_empresa_valor: number
          id?: string
          local_coleta_id: string
          local_descarga_id: string
          numero?: never
          observacao?: string | null
          peso_total_kg: number
          produto: string
          remetente_id: string
          situacao?: Database["public"]["Enums"]["situacao_pedido"]
          tipo_carga_antt?: Database["public"]["Enums"]["tipo_carga_antt"]
          tomador_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          coleta_prevista?: string | null
          created_at?: string
          created_by?: string | null
          destinatario_id?: string
          entrega_prevista?: string | null
          frete_empresa_origem?: Database["public"]["Enums"]["origem_frete"]
          frete_empresa_tipo?: Database["public"]["Enums"]["tipo_tarifa"]
          frete_empresa_valor?: number
          id?: string
          local_coleta_id?: string
          local_descarga_id?: string
          numero?: never
          observacao?: string | null
          peso_total_kg?: number
          produto?: string
          remetente_id?: string
          situacao?: Database["public"]["Enums"]["situacao_pedido"]
          tipo_carga_antt?: Database["public"]["Enums"]["tipo_carga_antt"]
          tomador_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "pedido_local_coleta_id_fkey"
            columns: ["local_coleta_id"]
            isOneToOne: false
            referencedRelation: "pessoa_endereco"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_local_descarga_id_fkey"
            columns: ["local_descarga_id"]
            isOneToOne: false
            referencedRelation: "pessoa_endereco"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "pedido_tomador_id_fkey"
            columns: ["tomador_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      perfil_usuario: {
        Row: {
          ativo: boolean
          created_at: string
          nome: string
          papel: Database["public"]["Enums"]["app_papel"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          ativo?: boolean
          created_at?: string
          nome: string
          papel: Database["public"]["Enums"]["app_papel"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          nome?: string
          papel?: Database["public"]["Enums"]["app_papel"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pessoa: {
        Row: {
          apelido: string | null
          cnae_principal: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          dados_brasilapi: Json | null
          dt_consulta_brasilapi: string | null
          dt_consulta_cpf: string | null
          dt_consulta_simples: string | null
          estado_civil: Database["public"]["Enums"]["estado_civil"] | null
          fundacao: string | null
          grau_instrucao: Database["public"]["Enums"]["grau_instrucao"] | null
          id: string
          inscricao_estadual: string | null
          inscricao_estadual_isento: boolean | null
          inscricao_municipal: string | null
          mae: string | null
          nascimento: string | null
          naturalidade: string | null
          naturalidade_uf: Database["public"]["Enums"]["uf"] | null
          natureza_juridica: string | null
          nome: string
          nome_fantasia: string | null
          nr_dependentes: number | null
          nr_inss: string | null
          observacao: string | null
          optante_simples: boolean | null
          pai: string | null
          qualificacao_inss: string | null
          raca_cor: Database["public"]["Enums"]["raca_cor"] | null
          rg: string | null
          rg_emissao: string | null
          rg_orgao: string | null
          rg_uf: Database["public"]["Enums"]["uf"] | null
          sexo: Database["public"]["Enums"]["sexo"] | null
          situacao_cadastro: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_cpf: Database["public"]["Enums"]["situacao_cpf"] | null
          tipo: Database["public"]["Enums"]["tipo_pessoa"]
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          apelido?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          dados_brasilapi?: Json | null
          dt_consulta_brasilapi?: string | null
          dt_consulta_cpf?: string | null
          dt_consulta_simples?: string | null
          estado_civil?: Database["public"]["Enums"]["estado_civil"] | null
          fundacao?: string | null
          grau_instrucao?: Database["public"]["Enums"]["grau_instrucao"] | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_estadual_isento?: boolean | null
          inscricao_municipal?: string | null
          mae?: string | null
          nascimento?: string | null
          naturalidade?: string | null
          naturalidade_uf?: Database["public"]["Enums"]["uf"] | null
          natureza_juridica?: string | null
          nome: string
          nome_fantasia?: string | null
          nr_dependentes?: number | null
          nr_inss?: string | null
          observacao?: string | null
          optante_simples?: boolean | null
          pai?: string | null
          qualificacao_inss?: string | null
          raca_cor?: Database["public"]["Enums"]["raca_cor"] | null
          rg?: string | null
          rg_emissao?: string | null
          rg_orgao?: string | null
          rg_uf?: Database["public"]["Enums"]["uf"] | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_cpf?: Database["public"]["Enums"]["situacao_cpf"] | null
          tipo: Database["public"]["Enums"]["tipo_pessoa"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          apelido?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          dados_brasilapi?: Json | null
          dt_consulta_brasilapi?: string | null
          dt_consulta_cpf?: string | null
          dt_consulta_simples?: string | null
          estado_civil?: Database["public"]["Enums"]["estado_civil"] | null
          fundacao?: string | null
          grau_instrucao?: Database["public"]["Enums"]["grau_instrucao"] | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_estadual_isento?: boolean | null
          inscricao_municipal?: string | null
          mae?: string | null
          nascimento?: string | null
          naturalidade?: string | null
          naturalidade_uf?: Database["public"]["Enums"]["uf"] | null
          natureza_juridica?: string | null
          nome?: string
          nome_fantasia?: string | null
          nr_dependentes?: number | null
          nr_inss?: string | null
          observacao?: string | null
          optante_simples?: boolean | null
          pai?: string | null
          qualificacao_inss?: string | null
          raca_cor?: Database["public"]["Enums"]["raca_cor"] | null
          rg?: string | null
          rg_emissao?: string | null
          rg_orgao?: string | null
          rg_uf?: Database["public"]["Enums"]["uf"] | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_cpf?: Database["public"]["Enums"]["situacao_cpf"] | null
          tipo?: Database["public"]["Enums"]["tipo_pessoa"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pessoa_chave_pix: {
        Row: {
          chave: string
          conta_id: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          pessoa_id: string
          principal: boolean
          tipo: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          chave: string
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          pessoa_id: string
          principal?: boolean
          tipo: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chave?: string
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          pessoa_id?: string
          principal?: boolean
          tipo?: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_chave_pix_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "pessoa_conta_bancaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_chave_pix_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_conta_bancaria: {
        Row: {
          agencia: string | null
          agencia_digito: string | null
          banco_codigo: string | null
          conta: string | null
          conta_digito: string | null
          created_at: string
          created_by: string | null
          favorecido_documento: string | null
          favorecido_nome: string | null
          id: string
          pessoa_id: string
          principal: boolean
          swift: string | null
          tipo: Database["public"]["Enums"]["tipo_conta"] | null
          titular_confere: boolean
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          agencia?: string | null
          agencia_digito?: string | null
          banco_codigo?: string | null
          conta?: string | null
          conta_digito?: string | null
          created_at?: string
          created_by?: string | null
          favorecido_documento?: string | null
          favorecido_nome?: string | null
          id?: string
          pessoa_id: string
          principal?: boolean
          swift?: string | null
          tipo?: Database["public"]["Enums"]["tipo_conta"] | null
          titular_confere?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agencia?: string | null
          agencia_digito?: string | null
          banco_codigo?: string | null
          conta?: string | null
          conta_digito?: string | null
          created_at?: string
          created_by?: string | null
          favorecido_documento?: string | null
          favorecido_nome?: string | null
          id?: string
          pessoa_id?: string
          principal?: boolean
          swift?: string | null
          tipo?: Database["public"]["Enums"]["tipo_conta"] | null
          titular_confere?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_conta_bancaria_banco_codigo_fkey"
            columns: ["banco_codigo"]
            isOneToOne: false
            referencedRelation: "banco"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "pessoa_conta_bancaria_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_email: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          observacao: string | null
          pessoa_id: string
          principal: boolean
          recebe_cte: boolean
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          observacao?: string | null
          pessoa_id: string
          principal?: boolean
          recebe_cte?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          observacao?: string | null
          pessoa_id?: string
          principal?: boolean
          recebe_cte?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_email_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_endereco: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string
          complemento: string | null
          contato_local: string | null
          created_at: string
          created_by: string | null
          id: string
          janela_atendimento: string | null
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          numero: string | null
          pessoa_id: string
          ponto_referencia: string | null
          principal: boolean
          tipo: Database["public"]["Enums"]["tipo_endereco"] | null
          uf: Database["public"]["Enums"]["uf"]
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade: string
          complemento?: string | null
          contato_local?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          janela_atendimento?: string | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          numero?: string | null
          pessoa_id: string
          ponto_referencia?: string | null
          principal?: boolean
          tipo?: Database["public"]["Enums"]["tipo_endereco"] | null
          uf: Database["public"]["Enums"]["uf"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string
          complemento?: string | null
          contato_local?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          janela_atendimento?: string | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          numero?: string | null
          pessoa_id?: string
          ponto_referencia?: string | null
          principal?: boolean
          tipo?: Database["public"]["Enums"]["tipo_endereco"] | null
          uf?: Database["public"]["Enums"]["uf"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_endereco_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_telefone: {
        Row: {
          contato: string | null
          created_at: string
          created_by: string | null
          id: string
          numero: string
          pessoa_id: string
          principal: boolean
          ramal: string | null
          restrito: boolean
          tipo: Database["public"]["Enums"]["tipo_telefone"] | null
          updated_at: string
          updated_by: string | null
          whatsapp: boolean
        }
        ComputedFields: never
        Insert: {
          contato?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          numero: string
          pessoa_id: string
          principal?: boolean
          ramal?: string | null
          restrito?: boolean
          tipo?: Database["public"]["Enums"]["tipo_telefone"] | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: boolean
        }
        Update: {
          contato?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          numero?: string
          pessoa_id?: string
          principal?: boolean
          ramal?: string | null
          restrito?: boolean
          tipo?: Database["public"]["Enums"]["tipo_telefone"] | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_telefone_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      proprietario: {
        Row: {
          agregado: boolean
          agregado_desde: string | null
          alto_desempenho: boolean
          autoriza_desconto_inss: Database["public"]["Enums"]["desconto_inss"]
          created_at: string
          created_by: string | null
          dt_qualificacao_gmp: string | null
          enquadramento_antt:
            | Database["public"]["Enums"]["enquadramento_antt"]
            | null
          frete_empresa_motorista_percentual: number | null
          frete_empresa_motorista_valor: number | null
          limite_adiantamento_percentual: number | null
          limite_adiantamento_valor: number | null
          pessoa_id: string
          qualificado_gmp: boolean | null
          regra_pgto_frete:
            | Database["public"]["Enums"]["regra_pgto_frete"]
            | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          responsavel_whatsapp: boolean | null
          rntrc: string | null
          rntrc_emissao: string | null
          rntrc_validade: string | null
          situacao_cadastro: Database["public"]["Enums"]["situacao_cadastro"]
          taxa_adm_percentual: number | null
          taxa_adm_valor: number | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          agregado?: boolean
          agregado_desde?: string | null
          alto_desempenho?: boolean
          autoriza_desconto_inss?: Database["public"]["Enums"]["desconto_inss"]
          created_at?: string
          created_by?: string | null
          dt_qualificacao_gmp?: string | null
          enquadramento_antt?:
            | Database["public"]["Enums"]["enquadramento_antt"]
            | null
          frete_empresa_motorista_percentual?: number | null
          frete_empresa_motorista_valor?: number | null
          limite_adiantamento_percentual?: number | null
          limite_adiantamento_valor?: number | null
          pessoa_id: string
          qualificado_gmp?: boolean | null
          regra_pgto_frete?:
            | Database["public"]["Enums"]["regra_pgto_frete"]
            | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          responsavel_whatsapp?: boolean | null
          rntrc?: string | null
          rntrc_emissao?: string | null
          rntrc_validade?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          taxa_adm_percentual?: number | null
          taxa_adm_valor?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agregado?: boolean
          agregado_desde?: string | null
          alto_desempenho?: boolean
          autoriza_desconto_inss?: Database["public"]["Enums"]["desconto_inss"]
          created_at?: string
          created_by?: string | null
          dt_qualificacao_gmp?: string | null
          enquadramento_antt?:
            | Database["public"]["Enums"]["enquadramento_antt"]
            | null
          frete_empresa_motorista_percentual?: number | null
          frete_empresa_motorista_valor?: number | null
          limite_adiantamento_percentual?: number | null
          limite_adiantamento_valor?: number | null
          pessoa_id?: string
          qualificado_gmp?: boolean | null
          regra_pgto_frete?:
            | Database["public"]["Enums"]["regra_pgto_frete"]
            | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          responsavel_whatsapp?: boolean | null
          rntrc?: string | null
          rntrc_emissao?: string | null
          rntrc_validade?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          taxa_adm_percentual?: number | null
          taxa_adm_valor?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proprietario_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: true
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      quadro_limite: {
        Row: {
          chave: string
          minutos_ambar: number
          minutos_vermelho: number
        }
        ComputedFields: never
        Insert: {
          chave: string
          minutos_ambar: number
          minutos_vermelho: number
        }
        Update: {
          chave?: string
          minutos_ambar?: number
          minutos_vermelho?: number
        }
        Relationships: []
      }
      rota_salva: {
        Row: {
          chave: string
          created_at: string
          created_by: string | null
          destino: string
          eixos: number
          id: string
          km: number
          origem: string
          pedagio: number | null
          updated_at: string
          updated_by: string | null
          vias: string[]
        }
        ComputedFields: never
        Insert: {
          chave: string
          created_at?: string
          created_by?: string | null
          destino: string
          eixos: number
          id?: string
          km: number
          origem: string
          pedagio?: number | null
          updated_at?: string
          updated_by?: string | null
          vias?: string[]
        }
        Update: {
          chave?: string
          created_at?: string
          created_by?: string | null
          destino?: string
          eixos?: number
          id?: string
          km?: number
          origem?: string
          pedagio?: number | null
          updated_at?: string
          updated_by?: string | null
          vias?: string[]
        }
        Relationships: []
      }
      tipo_arquivo: {
        Row: {
          aplica_pessoa: boolean
          aplica_veiculo: boolean
          aplica_viagem: boolean
          id: number
          nome: string
        }
        ComputedFields: never
        Insert: {
          aplica_pessoa?: boolean
          aplica_veiculo?: boolean
          aplica_viagem?: boolean
          id?: number
          nome: string
        }
        Update: {
          aplica_pessoa?: boolean
          aplica_veiculo?: boolean
          aplica_viagem?: boolean
          id?: number
          nome?: string
        }
        Relationships: []
      }
      tipo_veiculo: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_veiculo"]
          configuracao_cavalo:
            | Database["public"]["Enums"]["configuracao_cavalo"]
            | null
          eixos: number
          id: number
          nome: string
        }
        ComputedFields: never
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_veiculo"]
          configuracao_cavalo?:
            | Database["public"]["Enums"]["configuracao_cavalo"]
            | null
          eixos: number
          id?: number
          nome: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_veiculo"]
          configuracao_cavalo?:
            | Database["public"]["Enums"]["configuracao_cavalo"]
            | null
          eixos?: number
          id?: number
          nome?: string
        }
        Relationships: []
      }
      unidade_operacional: {
        Row: {
          id: number
          nome: string
        }
        ComputedFields: never
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      veiculo: {
        Row: {
          altura_m: number | null
          ano_fabricacao: number | null
          ano_modelo: number | null
          apolice: string | null
          aquisicao: string | null
          arrendado: boolean | null
          capacidade_carga_t: number | null
          centro_custo_id: number | null
          chassi: string | null
          cidade_emplacamento: string | null
          cmt_t: number | null
          comprimento_m: number | null
          cor: string | null
          created_at: string
          created_by: string | null
          dt_emissao_crlv: string | null
          exercicio_doc: number | null
          hp: number | null
          id: string
          km_inicial: number | null
          largura_m: number | null
          litros_tanque: number | null
          marca_id: number | null
          media_padrao_carregado: number | null
          media_padrao_vazio: number | null
          modelo: string | null
          nr_certificado_doc: string | null
          nr_frota: string | null
          nr_motor: string | null
          nr_registro_crlv: string | null
          nr_seguranca_crlv: string | null
          observacao: string | null
          pbt_t: number | null
          pgr_sm_automatica: boolean | null
          placa: string
          potencia_motor: string | null
          proprietario_documento_id: string
          proprietario_posse_id: string
          rastreador_empresa: string | null
          rastreador_modelo: string | null
          rastreador_numero: string | null
          rastreador_observacao: string | null
          rastreamento_tipo:
            | Database["public"]["Enums"]["tipo_rastreamento"]
            | null
          recebedor_valores:
            | Database["public"]["Enums"]["recebedor_valores"]
            | null
          renavam: string | null
          seguradora: string | null
          seguro_validade: string | null
          situacao_cadastro: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_operacional: Database["public"]["Enums"]["situacao_operacional"]
          tag_numero: string | null
          tag_operadora_id: number | null
          tara_t: number | null
          tipo_assoalho: Database["public"]["Enums"]["tipo_assoalho"] | null
          tipo_veiculo_id: number
          uf_emplacamento: Database["public"]["Enums"]["uf"] | null
          ultimo_motorista_id: string | null
          unidade_operacional_id: number | null
          updated_at: string
          updated_by: string | null
          venc_ipva: string | null
          vl_compra: number | null
          vl_mercado: number | null
          capacidade_carga: number | null
        }
        ComputedFields: "capacidade_carga"
        Insert: {
          altura_m?: number | null
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          apolice?: string | null
          aquisicao?: string | null
          arrendado?: never
          capacidade_carga_t?: number | null
          centro_custo_id?: number | null
          chassi?: string | null
          cidade_emplacamento?: string | null
          cmt_t?: number | null
          comprimento_m?: number | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          dt_emissao_crlv?: string | null
          exercicio_doc?: number | null
          hp?: number | null
          id?: string
          km_inicial?: number | null
          largura_m?: number | null
          litros_tanque?: number | null
          marca_id?: number | null
          media_padrao_carregado?: number | null
          media_padrao_vazio?: number | null
          modelo?: string | null
          nr_certificado_doc?: string | null
          nr_frota?: string | null
          nr_motor?: string | null
          nr_registro_crlv?: string | null
          nr_seguranca_crlv?: string | null
          observacao?: string | null
          pbt_t?: number | null
          pgr_sm_automatica?: boolean | null
          placa: string
          potencia_motor?: string | null
          proprietario_documento_id: string
          proprietario_posse_id: string
          rastreador_empresa?: string | null
          rastreador_modelo?: string | null
          rastreador_numero?: string | null
          rastreador_observacao?: string | null
          rastreamento_tipo?:
            | Database["public"]["Enums"]["tipo_rastreamento"]
            | null
          recebedor_valores?:
            | Database["public"]["Enums"]["recebedor_valores"]
            | null
          renavam?: string | null
          seguradora?: string | null
          seguro_validade?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_operacional?: Database["public"]["Enums"]["situacao_operacional"]
          tag_numero?: string | null
          tag_operadora_id?: number | null
          tara_t?: number | null
          tipo_assoalho?: Database["public"]["Enums"]["tipo_assoalho"] | null
          tipo_veiculo_id: number
          uf_emplacamento?: Database["public"]["Enums"]["uf"] | null
          ultimo_motorista_id?: string | null
          unidade_operacional_id?: number | null
          updated_at?: string
          updated_by?: string | null
          venc_ipva?: string | null
          vl_compra?: number | null
          vl_mercado?: number | null
        }
        Update: {
          altura_m?: number | null
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          apolice?: string | null
          aquisicao?: string | null
          arrendado?: never
          capacidade_carga_t?: number | null
          centro_custo_id?: number | null
          chassi?: string | null
          cidade_emplacamento?: string | null
          cmt_t?: number | null
          comprimento_m?: number | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          dt_emissao_crlv?: string | null
          exercicio_doc?: number | null
          hp?: number | null
          id?: string
          km_inicial?: number | null
          largura_m?: number | null
          litros_tanque?: number | null
          marca_id?: number | null
          media_padrao_carregado?: number | null
          media_padrao_vazio?: number | null
          modelo?: string | null
          nr_certificado_doc?: string | null
          nr_frota?: string | null
          nr_motor?: string | null
          nr_registro_crlv?: string | null
          nr_seguranca_crlv?: string | null
          observacao?: string | null
          pbt_t?: number | null
          pgr_sm_automatica?: boolean | null
          placa?: string
          potencia_motor?: string | null
          proprietario_documento_id?: string
          proprietario_posse_id?: string
          rastreador_empresa?: string | null
          rastreador_modelo?: string | null
          rastreador_numero?: string | null
          rastreador_observacao?: string | null
          rastreamento_tipo?:
            | Database["public"]["Enums"]["tipo_rastreamento"]
            | null
          recebedor_valores?:
            | Database["public"]["Enums"]["recebedor_valores"]
            | null
          renavam?: string | null
          seguradora?: string | null
          seguro_validade?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_operacional?: Database["public"]["Enums"]["situacao_operacional"]
          tag_numero?: string | null
          tag_operadora_id?: number | null
          tara_t?: number | null
          tipo_assoalho?: Database["public"]["Enums"]["tipo_assoalho"] | null
          tipo_veiculo_id?: number
          uf_emplacamento?: Database["public"]["Enums"]["uf"] | null
          ultimo_motorista_id?: string | null
          unidade_operacional_id?: number | null
          updated_at?: string
          updated_by?: string | null
          venc_ipva?: string | null
          vl_compra?: number | null
          vl_mercado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marca_veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_proprietario_documento_id_fkey"
            columns: ["proprietario_documento_id"]
            isOneToOne: false
            referencedRelation: "proprietario"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "veiculo_proprietario_posse_id_fkey"
            columns: ["proprietario_posse_id"]
            isOneToOne: false
            referencedRelation: "proprietario"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "veiculo_tag_operadora_id_fkey"
            columns: ["tag_operadora_id"]
            isOneToOne: false
            referencedRelation: "operadora_tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_tipo_veiculo_id_fkey"
            columns: ["tipo_veiculo_id"]
            isOneToOne: false
            referencedRelation: "tipo_veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_ultimo_motorista_id_fkey"
            columns: ["ultimo_motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "veiculo_ultimo_motorista_id_fkey"
            columns: ["ultimo_motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "veiculo_unidade_operacional_id_fkey"
            columns: ["unidade_operacional_id"]
            isOneToOne: false
            referencedRelation: "unidade_operacional"
            referencedColumns: ["id"]
          },
        ]
      }
      viagem: {
        Row: {
          averbacao_seguro: string | null
          cancelada_em: string | null
          cancelada_por: string | null
          cancelamento_motivo: string | null
          cavalo_id: string
          chave_cte: string | null
          chave_mdfe: string | null
          chave_nfe: string | null
          checklist_veiculo_em: string | null
          ciot: string | null
          ciot_encerrado_em: string | null
          conjunto_id: string
          created_at: string
          created_by: string | null
          divergencia: Database["public"]["Enums"]["resultado_contagem"] | null
          divergencia_descricao: string | null
          finalizada_em: string | null
          frete_motorista_tipo:
            | Database["public"]["Enums"]["tipo_tarifa"]
            | null
          frete_motorista_valor: number | null
          id: string
          iniciada_em: string | null
          iniciada_por: string | null
          km_viagem: number | null
          liberacao_aptidao: Json | null
          liberacao_justificativa: string | null
          mdfe_encerrado_em: string | null
          motorista_id: string
          numero: number
          observacao: string | null
          pagamento_pelo_financeiro: boolean
          pagamento_saida_em: string | null
          pagamento_saida_por: string | null
          pedagio_valor: number | null
          pedido_id: string
          peso_chegada_kg: number | null
          peso_previsto_kg: number
          peso_saida_kg: number | null
          resolucao: string | null
          saldo_pago_em: string | null
          saldo_pago_por: string | null
          status_campo: Database["public"]["Enums"]["status_campo"] | null
          status_desde: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          averbacao_seguro?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          cancelamento_motivo?: string | null
          cavalo_id: string
          chave_cte?: string | null
          chave_mdfe?: string | null
          chave_nfe?: string | null
          checklist_veiculo_em?: string | null
          ciot?: string | null
          ciot_encerrado_em?: string | null
          conjunto_id: string
          created_at?: string
          created_by?: string | null
          divergencia?: Database["public"]["Enums"]["resultado_contagem"] | null
          divergencia_descricao?: string | null
          finalizada_em?: string | null
          frete_motorista_tipo?:
            | Database["public"]["Enums"]["tipo_tarifa"]
            | null
          frete_motorista_valor?: number | null
          id?: string
          iniciada_em?: string | null
          iniciada_por?: string | null
          km_viagem?: number | null
          liberacao_aptidao?: Json | null
          liberacao_justificativa?: string | null
          mdfe_encerrado_em?: string | null
          motorista_id: string
          numero?: never
          observacao?: string | null
          pagamento_pelo_financeiro?: boolean
          pagamento_saida_em?: string | null
          pagamento_saida_por?: string | null
          pedagio_valor?: number | null
          pedido_id: string
          peso_chegada_kg?: number | null
          peso_previsto_kg: number
          peso_saida_kg?: number | null
          resolucao?: string | null
          saldo_pago_em?: string | null
          saldo_pago_por?: string | null
          status_campo?: Database["public"]["Enums"]["status_campo"] | null
          status_desde?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          averbacao_seguro?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          cancelamento_motivo?: string | null
          cavalo_id?: string
          chave_cte?: string | null
          chave_mdfe?: string | null
          chave_nfe?: string | null
          checklist_veiculo_em?: string | null
          ciot?: string | null
          ciot_encerrado_em?: string | null
          conjunto_id?: string
          created_at?: string
          created_by?: string | null
          divergencia?: Database["public"]["Enums"]["resultado_contagem"] | null
          divergencia_descricao?: string | null
          finalizada_em?: string | null
          frete_motorista_tipo?:
            | Database["public"]["Enums"]["tipo_tarifa"]
            | null
          frete_motorista_valor?: number | null
          id?: string
          iniciada_em?: string | null
          iniciada_por?: string | null
          km_viagem?: number | null
          liberacao_aptidao?: Json | null
          liberacao_justificativa?: string | null
          mdfe_encerrado_em?: string | null
          motorista_id?: string
          numero?: never
          observacao?: string | null
          pagamento_pelo_financeiro?: boolean
          pagamento_saida_em?: string | null
          pagamento_saida_por?: string | null
          pedagio_valor?: number | null
          pedido_id?: string
          peso_chegada_kg?: number | null
          peso_previsto_kg?: number
          peso_saida_kg?: number | null
          resolucao?: string | null
          saldo_pago_em?: string | null
          saldo_pago_por?: string | null
          status_campo?: Database["public"]["Enums"]["status_campo"] | null
          status_desde?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viagem_cavalo_id_fkey"
            columns: ["cavalo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_conjunto_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "conjunto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_conjunto_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "v_conjunto_capacidade"
            referencedColumns: ["conjunto_id"]
          },
          {
            foreignKeyName: "viagem_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "viagem_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "viagem_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_saldo"
            referencedColumns: ["pedido_id"]
          },
        ]
      }
      viagem_evento: {
        Row: {
          dados: NonNullable<Json>
          de: Database["public"]["Enums"]["status_campo"] | null
          em: string
          id: number
          motivo: string | null
          para: Database["public"]["Enums"]["status_campo"] | null
          por: string | null
          viagem_id: string
        }
        ComputedFields: never
        Insert: {
          dados?: NonNullable<Json>
          de?: Database["public"]["Enums"]["status_campo"] | null
          em?: string
          id?: never
          motivo?: string | null
          para?: Database["public"]["Enums"]["status_campo"] | null
          por?: string | null
          viagem_id: string
        }
        Update: {
          dados?: NonNullable<Json>
          de?: Database["public"]["Enums"]["status_campo"] | null
          em?: string
          id?: never
          motivo?: string | null
          para?: Database["public"]["Enums"]["status_campo"] | null
          por?: string | null
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagem_evento_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_quadro"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "viagem_evento_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_viagem_planejada"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "viagem_evento_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
      viagem_ocorrencia: {
        Row: {
          aberta_em: string
          aberta_por: string | null
          descricao: string
          id: string
          resolucao: string | null
          resolvida_em: string | null
          resolvida_por: string | null
          tipo: Database["public"]["Enums"]["tipo_ocorrencia"]
          viagem_id: string
        }
        ComputedFields: never
        Insert: {
          aberta_em?: string
          aberta_por?: string | null
          descricao: string
          id?: string
          resolucao?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_ocorrencia"]
          viagem_id: string
        }
        Update: {
          aberta_em?: string
          aberta_por?: string | null
          descricao?: string
          id?: string
          resolucao?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_ocorrencia"]
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagem_ocorrencia_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_quadro"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "viagem_ocorrencia_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_viagem_planejada"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "viagem_ocorrencia_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
      viagem_pausa: {
        Row: {
          coluna_origem: Database["public"]["Enums"]["status_campo"]
          fim: string | null
          id: string
          inicio: string
          programada: boolean
          tipo: Database["public"]["Enums"]["tipo_pausa"]
          viagem_id: string
        }
        ComputedFields: never
        Insert: {
          coluna_origem: Database["public"]["Enums"]["status_campo"]
          fim?: string | null
          id?: string
          inicio?: string
          programada: boolean
          tipo: Database["public"]["Enums"]["tipo_pausa"]
          viagem_id: string
        }
        Update: {
          coluna_origem?: Database["public"]["Enums"]["status_campo"]
          fim?: string | null
          id?: string
          inicio?: string
          programada?: boolean
          tipo?: Database["public"]["Enums"]["tipo_pausa"]
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagem_pausa_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_quadro"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "viagem_pausa_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_viagem_planejada"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "viagem_pausa_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fin_resumo_mensal: {
        Row: {
          categoria: Database["public"]["Enums"]["fin_categoria"] | null
          mes: string | null
          quantidade: number | null
          valor: number | null
        }
        ComputedFields: never
        Relationships: []
      }
      v_conjunto_capacidade: {
        Row: {
          capacidade_total_t: number | null
          cavalo_id: string
          cmt_t: number | null
          conjunto_id: string
          excede_cmt: boolean | null
          tara_total_t: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "conjunto_cavalo_id_fkey"
            columns: ["cavalo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      v_fin_pagar: {
        Row: {
          aberta: boolean | null
          antecipacao_liberada_em: string | null
          antecipacao_liberada_por: string | null
          antecipacao_motivo: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          cancelado_automatico: boolean
          cancelado_em: string | null
          cancelado_por: string | null
          cancelamento_motivo: string | null
          centro_codigo: string
          centro_custo_id: number
          centro_nome: string
          competencia: string | null
          conta_id: string | null
          created_at: string
          descricao: string
          editado_por: string | null
          favorecido_id: string | null
          favorecido_nome: string
          forma: Database["public"]["Enums"]["fin_forma"]
          id: string
          lancado_por: string | null
          numero: number
          observacao: string | null
          origem: string
          pago_em: string | null
          pago_por: string | null
          pago_registrado_em: string | null
          parte_pedagio: number
          parte_retencao: number
          plano_grupo: Database["public"]["Enums"]["fin_grupo_plano"]
          plano_id: number
          plano_nome: string
          situacao: string | null
          updated_at: string
          updated_by: string | null
          valor: number
          vencida: boolean | null
          vencimento: string
          viagem_id: string | null
          viagem_numero: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "fin_pagar_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pagar_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pagar_favorecido_id_fkey"
            columns: ["favorecido_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pagar_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_pagar_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_quadro"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "fin_pagar_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_viagem_planejada"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "fin_pagar_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
      v_fin_receber: {
        Row: {
          aberta: boolean | null
          cancelado_em: string | null
          cancelado_por: string | null
          cancelamento_motivo: string | null
          centro_codigo: string
          centro_custo_id: number
          centro_nome: string
          cliente_documento: string | null
          cliente_id: string
          cliente_nome: string | null
          conta_id: string | null
          created_at: string
          editado_por: string | null
          forma: Database["public"]["Enums"]["fin_forma"]
          id: string
          lancado_por: string | null
          numero: number
          observacao: string | null
          origem: string
          plano_id: number
          plano_nome: string
          recebido_em: string | null
          recebido_por: string | null
          recebido_registrado_em: string | null
          situacao: string | null
          titulo: string
          updated_at: string
          updated_by: string | null
          valor: number
          vencida: boolean | null
          vencimento: string
          viagem_id: string | null
          viagem_numero: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "fin_receber_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "fin_receber_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_receber_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "fin_plano_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_receber_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_quadro"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "fin_receber_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "v_viagem_planejada"
            referencedColumns: ["viagem_id"]
          },
          {
            foreignKeyName: "fin_receber_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
      v_frete_pago_rota: {
        Row: {
          destino: string | null
          dia: string | null
          eixos: number | null
          fonte: string | null
          id: string | null
          km: number | null
          motorista_id: string | null
          origem: string | null
          valor: number | null
        }
        ComputedFields: never
        Relationships: []
      }
      v_motorista_livre: {
        Row: {
          cidade: string
          created_at: string
          id: string
          latitude: number
          livre_ate: string
          livre_desde: string
          longitude: number
          motorista_id: string
          observacao: string | null
          ocorrencias: number | null
          viagens_finalizadas: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "motorista_disponibilidade_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "motorista_disponibilidade_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      v_motorista_situacao: {
        Row: {
          cnh_validade: string | null
          cpf: string | null
          nome: string
          pessoa_id: string
          situacao_dados: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "motorista_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: true
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pedido_saldo: {
        Row: {
          numero: number
          pedido_id: string
          peso_alocado_kg: number | null
          peso_total_kg: number
          saldo_kg: number | null
          situacao: Database["public"]["Enums"]["situacao_pedido"]
          tomador_id: string
          viagens: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "pedido_tomador_id_fkey"
            columns: ["tomador_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      v_pendencias_documentos: {
        Row: {
          arquivo_id: string | null
          descricao: string | null
          pessoa_id: string | null
          tipo_pendencia: string | null
          veiculo_id: string | null
        }
        ComputedFields: never
        Relationships: []
      }
      v_quadro: {
        Row: {
          adiantamento_no_financeiro: boolean | null
          cavalo_placa: string | null
          cliente_nome: string | null
          destino_cidade: string | null
          destino_uf: Database["public"]["Enums"]["uf"] | null
          divergencia: Database["public"]["Enums"]["resultado_contagem"] | null
          iniciada_por: string | null
          motorista_nome: string | null
          numero: number
          ocorrencias_abertas: number | null
          origem_cidade: string | null
          origem_uf: Database["public"]["Enums"]["uf"] | null
          pagamento_saida: boolean | null
          pausa_inicio: string | null
          pausa_programada: boolean | null
          pausa_tipo: Database["public"]["Enums"]["tipo_pausa"] | null
          peso_chegada_kg: number | null
          peso_saida_kg: number | null
          saldo_no_financeiro: boolean | null
          saldo_pago: boolean | null
          status_campo: Database["public"]["Enums"]["status_campo"] | null
          status_desde: string | null
          tem_canhoto: boolean | null
          tem_chaves: boolean | null
          tem_documentos_saida: boolean | null
          tolerancia_quebra_pct: number | null
          unidade_operacional_id: number | null
          viagem_id: string
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "veiculo_unidade_operacional_id_fkey"
            columns: ["unidade_operacional_id"]
            isOneToOne: false
            referencedRelation: "unidade_operacional"
            referencedColumns: ["id"]
          },
        ]
      }
      v_vencimentos: {
        Row: {
          arquivo_id: string | null
          data: string | null
          dias: number | null
          pessoa_id: string | null
          tipo: string | null
          veiculo_id: string | null
        }
        ComputedFields: never
        Relationships: []
      }
      v_viagem_planejada: {
        Row: {
          aptidao: Json | null
          avisos: number | null
          cavalo_placa: string | null
          cliente_nome: string | null
          motorista_nome: string | null
          numero: number
          pedido_id: string
          pedido_numero: number | null
          travas: number | null
          viagem_id: string
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "viagem_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_saldo"
            referencedColumns: ["pedido_id"]
          },
        ]
      }
    }
    Functions: {
      aliquota_icms: {
        Args: {
          p_destino: Database["public"]["Enums"]["uf"]
          p_origem: Database["public"]["Enums"]["uf"]
        }
        Returns: number
      }
      antt_coeficiente_para: {
        Args: {
          p_dia: string
          p_eixos: number
          p_tipo: Database["public"]["Enums"]["tipo_carga_antt"]
        }
        Returns: {
          cc: number
          ccd: number
          eixos_tabela: number
          portaria: string
          vigencia_inicio: string
        }[]
      }
      aprovar_conjunto: {
        Args: { p_aprovar?: boolean; p_conjunto: string }
        Returns: undefined
      }
      aptidao_conjuntos: {
        Args: { p_conjuntos: string[]; p_tomador?: string }
        Returns: {
          codigo: string
          conjunto_id: string
          mensagem: string
          nivel: string
        }[]
      }
      aptidao_da_viagem: { Args: { p_viagem: string }; Returns: Json }
      aptidao_viagem: {
        Args: { p_conjunto: string; p_tomador?: string }
        Returns: {
          codigo: string
          mensagem: string
          nivel: string
        }[]
      }
      arquivo_restrito: { Args: { p_path: string }; Returns: boolean }
      auditar: { Args: { p_tabela: unknown }; Returns: undefined }
      calcular_cte: { Args: { p: Json; p_dia?: string }; Returns: Json }
      cancelar_viagem: {
        Args: { p_motivo: string; p_viagem: string }
        Returns: undefined
      }
      canhoto_enviado: { Args: { p_viagem: string }; Returns: boolean }
      capacidade_carga: {
        Args: {
          v: Omit<
            Database["public"]["Tables"]["veiculo"]["Row"],
            Database["public"]["Tables"]["veiculo"]["ComputedFields"]
          >
        }
        Returns: number
      }
      chave_dfe_valida: {
        Args: { p_chave: string; p_modelo: string }
        Returns: boolean
      }
      cnpj_valido: { Args: { p: string }; Returns: boolean }
      confirmar_pagamento_saida: {
        Args: { p_viagem: string }
        Returns: undefined
      }
      confirmar_saldo: { Args: { p_viagem: string }; Returns: undefined }
      contratar_lote: {
        Args: { p_itens: Json; p_pedido: string }
        Returns: string[]
      }
      cpf_valido: { Args: { p: string }; Returns: boolean }
      definir_perfil: {
        Args: {
          p_ativo: boolean
          p_nome: string
          p_papel: Database["public"]["Enums"]["app_papel"]
          p_user_id: string
        }
        Returns: undefined
      }
      eh_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      encerrar_conjunto: { Args: { p_conjunto_id: string }; Returns: undefined }
      existe_arquivo_enviado: {
        Args: { p_pessoa_id: string; p_tipo: string; p_veiculo_id: string }
        Returns: boolean
      }
      faixa_margem: { Args: { p: number }; Returns: string }
      fin_aprovar_pagar: {
        Args: { p_id: string; p_versao?: string }
        Returns: undefined
      }
      fin_cancelar_pagar: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      fin_cancelar_receber: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      fin_categoria_por_regra: {
        Args: { p_chave: string }
        Returns: Database["public"]["Enums"]["fin_categoria"]
      }
      fin_chave_contem: {
        Args: { p_chave: string; p_regra: string }
        Returns: boolean
      }
      fin_chave_serve_para_regra: {
        Args: { p_chave: string }
        Returns: boolean
      }
      fin_classificar: {
        Args: {
          p_categoria: Database["public"]["Enums"]["fin_categoria"]
          p_id: string
          p_lembrar?: boolean
        }
        Returns: number
      }
      fin_classificar_lancamento: {
        Args: {
          p_categoria: Database["public"]["Enums"]["fin_categoria"]
          p_id: string
          p_lembrar?: boolean
        }
        Returns: Json
      }
      fin_conferir_classificacao: {
        Args: { p_centro: number; p_plano: number; p_saida: boolean }
        Returns: undefined
      }
      fin_definir_parcelas_frete: {
        Args: { p_ativo: boolean }
        Returns: undefined
      }
      fin_desaprovar_pagar: { Args: { p_id: string }; Returns: undefined }
      fin_desfazer_pagamento: { Args: { p_id: string }; Returns: undefined }
      fin_desfazer_recebimento: { Args: { p_id: string }; Returns: undefined }
      fin_importar_extrato: { Args: { p: Json }; Returns: Json }
      fin_indicadores_contas: { Args: { p_mes: string }; Returns: Json }
      fin_lancar_taxa_cartao: { Args: { p_mes: string }; Returns: string }
      fin_liberar_antecipacao: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      fin_pagar_conta: {
        Args: {
          p_conta?: string
          p_data: string
          p_forma?: Database["public"]["Enums"]["fin_forma"]
          p_id: string
        }
        Returns: undefined
      }
      fin_receber_conta: {
        Args: { p_conta?: string; p_data: string; p_id: string }
        Returns: undefined
      }
      fin_saldos_ate: {
        Args: { p_fim: string }
        Returns: {
          agencia: string
          apelido: string
          banco: string
          conta_id: string
          numero: string
          saldo: number
          saldo_em: string
        }[]
      }
      fin_sincronizar_parcelas: {
        Args: { p_embarcou_agora?: boolean; p_viagem: string }
        Returns: undefined
      }
      fin_taxa_cartao: {
        Args: { p_mes: string }
        Returns: {
          conta_id: string
          conta_numero: number
          conta_situacao: string
          conta_valor: number
          pagamentos: number
          pct: number
          por_transferencia: number
          taxa: number
          total_pago: number
          valor_pct: number
          valor_transferencias: number
        }[]
      }
      fiscal_gerar_guias: { Args: { p_competencia: string }; Returns: number }
      fiscal_marcar_guia: {
        Args: { p_data: string; p_guia: string }
        Returns: undefined
      }
      fiscal_retencoes: {
        Args: { p_competencia: string }
        Returns: {
          base: number
          base_irrf: number
          contratado_cpf: string
          contratado_id: string
          contratado_nome: string
          cte_numero: number
          data: string
          frete: number
          inss: number
          patronal: number
          senat: number
          sest: number
          viagem_id: string
          viagem_numero: number
        }[]
      }
      fiscal_vencimento_guia: {
        Args: { p_competencia: string }
        Returns: string
      }
      frete_da_viagem: { Args: { p_viagem: string }; Returns: Json }
      hoje_brasilia: { Args: Record<PropertyKey, never>; Returns: string }
      informar_cte_negociacao: {
        Args: { p_id: string; p_numero: string }
        Returns: undefined
      }
      iniciar_viagem: {
        Args: { p_justificativa?: string; p_viagem: string }
        Returns: undefined
      }
      listar_usuarios: {
        Args: Record<PropertyKey, never>
        Returns: {
          ativo: boolean
          email: string
          nome: string
          papel: Database["public"]["Enums"]["app_papel"]
          ultimo_acesso: string
          user_id: string
        }[]
      }
      mover_viagem: {
        Args: {
          p_dados?: Json
          p_de: Database["public"]["Enums"]["status_campo"]
          p_para: Database["public"]["Enums"]["status_campo"]
          p_viagem: string
        }
        Returns: undefined
      }
      nome_mes: { Args: { p: string }; Returns: string }
      nomes_usuarios: {
        Args: { p_ids: string[] }
        Returns: {
          nome: string
          user_id: string
        }[]
      }
      normalizar_placa: { Args: { p: string }; Returns: string }
      normalizar_rota: { Args: { p: string }; Returns: string }
      papel_atual: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_papel"]
      }
      parametros_calculadora: { Args: { p_dia?: string }; Returns: Json }
      parcelas_no_financeiro: {
        Args: { p_viagem: string }
        Returns: {
          adiantamento: boolean
          saldo: boolean
        }[]
      }
      piso_antt: {
        Args: {
          p_dia?: string
          p_eixos: number
          p_km: number
          p_retorno_vazio?: boolean
          p_tipo: Database["public"]["Enums"]["tipo_carga_antt"]
        }
        Returns: number
      }
      placa_valida: { Args: { p: string }; Returns: boolean }
      pode_editar: { Args: Record<PropertyKey, never>; Returns: boolean }
      pode_financeiro: { Args: Record<PropertyKey, never>; Returns: boolean }
      pode_ler: { Args: Record<PropertyKey, never>; Returns: boolean }
      quebra_e_estadia: { Args: { p_viagem: string }; Returns: Json }
      reais_texto: { Args: { p: number }; Returns: string }
      registrar_negociacao: {
        Args: {
          p: Json
          p_margem_liquida?: number
          p_resultado_liquido?: number
        }
        Returns: string
      }
      registrar_visualizacao: {
        Args: { p_arquivo: string }
        Returns: undefined
      }
      responder_negociacao: {
        Args: {
          p_aceita: boolean
          p_id: string
          p_motivo?: string
          p_valor_pedido?: number
        }
        Returns: string
      }
      resultado_cte_da_viagem: { Args: { p_viagem: string }; Returns: Json }
      rotulo_forma: {
        Args: { p: Database["public"]["Enums"]["fin_forma"] }
        Returns: string
      }
      rotulo_grupo_plano: {
        Args: { p: Database["public"]["Enums"]["fin_grupo_plano"] }
        Returns: string
      }
      rotulo_status_campo: {
        Args: { p: Database["public"]["Enums"]["status_campo"] }
        Returns: string
      }
      rotulo_tipo_carga_antt: {
        Args: { p: Database["public"]["Enums"]["tipo_carga_antt"] }
        Returns: string
      }
      salvar_conjunto: {
        Args: {
          p_cavalo_id: string
          p_conjunto_id: string
          p_itens: string[]
          p_motorista_id: string
        }
        Returns: string
      }
      salvar_rota: {
        Args: {
          p_destino: string
          p_eixos: number
          p_km: number
          p_origem: string
          p_pedagio?: number
          p_vias: string[]
        }
        Returns: string
      }
      so_digitos: { Args: { p: string }; Returns: string }
      tem_papel: {
        Args: { p: Database["public"]["Enums"]["app_papel"][] }
        Returns: boolean
      }
      validar_conjunto: { Args: { p_conjunto: string }; Returns: undefined }
      viagem_parcelas: {
        Args: { p_viagem: string }
        Returns: {
          antecipacao_liberada: boolean
          numero: number
          origem: string
          pago_em: string
          parte_pedagio: number
          parte_retencao: number
          situacao: string
          valor: number
          vencimento: string
        }[]
      }
    }
    Enums: {
      app_papel: "admin" | "operacao" | "financeiro" | "leitura"
      categoria_cnh:
        | "provisoria"
        | "a"
        | "b"
        | "c"
        | "d"
        | "e"
        | "ab"
        | "ac"
        | "ad"
        | "ae"
      categoria_veiculo: "cavalo" | "caminhao" | "carreta" | "dolly" | "outros"
      condicao_faturamento: "por_cte" | "semanal" | "quinzenal" | "mensal"
      configuracao_cavalo: "toco" | "trucado"
      desconto_inss: "nao" | "inss_sest_senat" | "sest_senat"
      enquadramento_antt: "etc" | "tac" | "ctc" | "etc_equiparado"
      estado_civil: "solteiro" | "casado" | "separado" | "viuvo" | "outro"
      fin_categoria:
        | "receita_frete"
        | "pagamento_frete"
        | "despesa"
        | "emprestimo"
        | "devolucao_emprestimo"
        | "aporte_capital"
        | "devolucao_capital"
        | "transferencia"
      fin_forma:
        | "pix"
        | "boleto"
        | "transferencia"
        | "cartao_frete"
        | "cartao_credito"
        | "debito_automatico"
        | "dinheiro"
        | "outro"
      fin_grupo_plano:
        | "receita"
        | "imposto_receita"
        | "custo_frete"
        | "despesa_operacional"
        | "financeiro"
        | "ir_csll"
        | "fora_resultado"
      fiscal_tipo_guia: "inss" | "sest_senat"
      grau_instrucao:
        | "fundamental_incompleto"
        | "fundamental_completo"
        | "medio_incompleto"
        | "medio_completo"
        | "superior_incompleto"
        | "superior_completo"
      origem_frete: "manual" | "tabela"
      raca_cor:
        | "branca"
        | "preta"
        | "parda"
        | "amarela"
        | "indigena"
        | "nao_informado"
      recebedor_valores: "motorista" | "proprietario" | "posto"
      regra_pgto_frete:
        | "peso_saida"
        | "peso_chegada"
        | "peso_chegada_se_menor"
        | "peso_chegada_com_tolerancia"
        | "peso_chegada_acima_tolerancia"
      resultado_contagem: "sem_divergencia" | "falta" | "sobra" | "avaria"
      sexo: "masculino" | "feminino"
      situacao_cadastro: "cancelado" | "pendente" | "normal"
      situacao_cpf:
        | "regular"
        | "titular_falecido"
        | "suspensa"
        | "pendente_regularizacao"
        | "cancelada_multiplicidade"
        | "nula"
        | "cancelada_oficio"
      situacao_gr: "sem_consulta" | "habilitado" | "vencido" | "recusado"
      situacao_negociacao: "aberta" | "aceita" | "recusada" | "cte_emitido"
      situacao_operacional:
        | "ag_motorista"
        | "apreendido"
        | "arrendado"
        | "ativo"
        | "a_venda"
        | "devolvido"
        | "parado"
        | "sinistro"
        | "vendido"
      situacao_pedido: "aberto" | "cancelado"
      status_campo:
        | "transito"
        | "aguardando_carregamento"
        | "em_carregamento"
        | "aguardando_nf_pagamento"
        | "em_rota"
        | "pausa"
        | "aguardando_descarga"
        | "descarregando"
        | "aguardando_contagem"
        | "resolucao_divergencia"
        | "aguardando_saldo"
        | "frete_finalizado"
      tipo_assoalho: "madeira" | "ferro" | "misto"
      tipo_carga_antt:
        | "granel_solido"
        | "carga_geral"
        | "granel_liquido"
        | "frigorificada"
        | "conteinerizada"
        | "neogranel"
        | "perigosa_granel_solido"
        | "perigosa_granel_liquido"
        | "perigosa_frigorificada"
        | "perigosa_conteinerizada"
        | "perigosa_carga_geral"
        | "granel_pressurizada"
      tipo_chave_pix: "cpf" | "cnpj" | "celular" | "email" | "aleatoria"
      tipo_conta: "corrente" | "poupanca" | "salario"
      tipo_endereco:
        | "residencial"
        | "comercial"
        | "coleta_descarga"
        | "cobranca"
        | "correspondencia"
      tipo_ocorrencia:
        | "atraso"
        | "avaria"
        | "recusa"
        | "sinistro"
        | "parada_nao_prevista"
        | "outro"
      tipo_pausa:
        | "almoco"
        | "banheiro"
        | "descanso_pernoite"
        | "abastecimento"
        | "manutencao"
        | "problema"
        | "outro"
      tipo_pessoa: "pf" | "pj"
      tipo_rastreamento: "telemonitorado" | "rastreador" | "localizador"
      tipo_referencia: "pessoal" | "comercial"
      tipo_tarifa: "total" | "por_tonelada"
      tipo_telefone: "residencial" | "comercial" | "celular" | "fax" | "radio"
      uf:
        | "AC"
        | "AL"
        | "AP"
        | "AM"
        | "BA"
        | "CE"
        | "DF"
        | "ES"
        | "GO"
        | "MA"
        | "MT"
        | "MS"
        | "MG"
        | "PA"
        | "PB"
        | "PR"
        | "PE"
        | "PI"
        | "RJ"
        | "RN"
        | "RS"
        | "RO"
        | "RR"
        | "SC"
        | "SP"
        | "SE"
        | "TO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_papel: ["admin", "operacao", "financeiro", "leitura"],
      categoria_cnh: [
        "provisoria",
        "a",
        "b",
        "c",
        "d",
        "e",
        "ab",
        "ac",
        "ad",
        "ae",
      ],
      categoria_veiculo: ["cavalo", "caminhao", "carreta", "dolly", "outros"],
      condicao_faturamento: ["por_cte", "semanal", "quinzenal", "mensal"],
      configuracao_cavalo: ["toco", "trucado"],
      desconto_inss: ["nao", "inss_sest_senat", "sest_senat"],
      enquadramento_antt: ["etc", "tac", "ctc", "etc_equiparado"],
      estado_civil: ["solteiro", "casado", "separado", "viuvo", "outro"],
      fin_categoria: [
        "receita_frete",
        "pagamento_frete",
        "despesa",
        "emprestimo",
        "devolucao_emprestimo",
        "aporte_capital",
        "devolucao_capital",
        "transferencia",
      ],
      fin_forma: [
        "pix",
        "boleto",
        "transferencia",
        "cartao_frete",
        "cartao_credito",
        "debito_automatico",
        "dinheiro",
        "outro",
      ],
      fin_grupo_plano: [
        "receita",
        "imposto_receita",
        "custo_frete",
        "despesa_operacional",
        "financeiro",
        "ir_csll",
        "fora_resultado",
      ],
      fiscal_tipo_guia: ["inss", "sest_senat"],
      grau_instrucao: [
        "fundamental_incompleto",
        "fundamental_completo",
        "medio_incompleto",
        "medio_completo",
        "superior_incompleto",
        "superior_completo",
      ],
      origem_frete: ["manual", "tabela"],
      raca_cor: [
        "branca",
        "preta",
        "parda",
        "amarela",
        "indigena",
        "nao_informado",
      ],
      recebedor_valores: ["motorista", "proprietario", "posto"],
      regra_pgto_frete: [
        "peso_saida",
        "peso_chegada",
        "peso_chegada_se_menor",
        "peso_chegada_com_tolerancia",
        "peso_chegada_acima_tolerancia",
      ],
      resultado_contagem: ["sem_divergencia", "falta", "sobra", "avaria"],
      sexo: ["masculino", "feminino"],
      situacao_cadastro: ["cancelado", "pendente", "normal"],
      situacao_cpf: [
        "regular",
        "titular_falecido",
        "suspensa",
        "pendente_regularizacao",
        "cancelada_multiplicidade",
        "nula",
        "cancelada_oficio",
      ],
      situacao_gr: ["sem_consulta", "habilitado", "vencido", "recusado"],
      situacao_negociacao: ["aberta", "aceita", "recusada", "cte_emitido"],
      situacao_operacional: [
        "ag_motorista",
        "apreendido",
        "arrendado",
        "ativo",
        "a_venda",
        "devolvido",
        "parado",
        "sinistro",
        "vendido",
      ],
      situacao_pedido: ["aberto", "cancelado"],
      status_campo: [
        "transito",
        "aguardando_carregamento",
        "em_carregamento",
        "aguardando_nf_pagamento",
        "em_rota",
        "pausa",
        "aguardando_descarga",
        "descarregando",
        "aguardando_contagem",
        "resolucao_divergencia",
        "aguardando_saldo",
        "frete_finalizado",
      ],
      tipo_assoalho: ["madeira", "ferro", "misto"],
      tipo_carga_antt: [
        "granel_solido",
        "carga_geral",
        "granel_liquido",
        "frigorificada",
        "conteinerizada",
        "neogranel",
        "perigosa_granel_solido",
        "perigosa_granel_liquido",
        "perigosa_frigorificada",
        "perigosa_conteinerizada",
        "perigosa_carga_geral",
        "granel_pressurizada",
      ],
      tipo_chave_pix: ["cpf", "cnpj", "celular", "email", "aleatoria"],
      tipo_conta: ["corrente", "poupanca", "salario"],
      tipo_endereco: [
        "residencial",
        "comercial",
        "coleta_descarga",
        "cobranca",
        "correspondencia",
      ],
      tipo_ocorrencia: [
        "atraso",
        "avaria",
        "recusa",
        "sinistro",
        "parada_nao_prevista",
        "outro",
      ],
      tipo_pausa: [
        "almoco",
        "banheiro",
        "descanso_pernoite",
        "abastecimento",
        "manutencao",
        "problema",
        "outro",
      ],
      tipo_pessoa: ["pf", "pj"],
      tipo_rastreamento: ["telemonitorado", "rastreador", "localizador"],
      tipo_referencia: ["pessoal", "comercial"],
      tipo_tarifa: ["total", "por_tonelada"],
      tipo_telefone: ["residencial", "comercial", "celular", "fax", "radio"],
      uf: [
        "AC",
        "AL",
        "AP",
        "AM",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MT",
        "MS",
        "MG",
        "PA",
        "PB",
        "PR",
        "PE",
        "PI",
        "RJ",
        "RN",
        "RS",
        "RO",
        "RR",
        "SC",
        "SP",
        "SE",
        "TO",
      ],
    },
  },
} as const
