export const python_initialization_script = `
# ---------------- VARIABLE INSPECTOR ----------------
import json
import sys
from IPython import get_ipython
from IPython.core.magics.namespace import NamespaceMagics

_jupyterlab_variableinspector_nms = NamespaceMagics()
_jupyterlab_variableinspector_Jupyter = get_ipython()
_jupyterlab_variableinspector_nms.shell = _jupyterlab_variableinspector_Jupyter.kernel.shell

def ed_keep_dataframes(v):
    try:
        obj = eval(v)
        # Check if datadrame
        if isinstance(obj, pd.core.frame.DataFrame):
            return True
        return False
    except:
        return False

def ed_variableinspector_dict_list():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vardic = [{'varName': _v} for _v in values if ed_keep_dataframes(_v)]
    return json.dumps(vardic, ensure_ascii=False)

def ed_variableinspector_array():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vararray = [_v for _v in values if ed_keep_dataframes(_v)]
    return vararray

# ---------------- GET DF COLUMNS AS JSON ----------------
def ed_get_json_column_values(df):
    return json.dumps(df.columns.tolist(), ensure_ascii=False)

# ---------------- QUERYBUILDER BACKEND ----------------
def ed_get_percentage_unique_column(df, col_name):
    return df[col_name].nunique() / df[col_name].count() * 100.0 

def ed_generate_querybuilder_config(df):
    queryprops = {}
    for i,col_type in enumerate(df.dtypes):
        col_name = df.columns[i]
        if col_type == 'int64':      
            queryprops[col_name] = {
                'label' : col_name,
                'type' : 'number'
            }
        elif col_type == 'float64':
            queryprops[col_name] = {
                'label' : col_name,
                'type' : 'number'
            }
        elif col_type == 'bool':
            queryprops[col_name] = {
                'label' : col_name,
                'type' : 'boolean'
            }
        elif col_type == 'object':
            # Categorical if less than 10% of values are unique
            if df[col_name].dtype == np.object:
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'text'
                }
            elif (ed_get_percentage_unique_column(df, col_name) < 10):
                queryprops[col_name] = {
                'label' : col_name,
                'type' : 'select',
                'fieldSettings' : {
                    'listValues' : [{'value': row, 'title': row} for row in df[col_name].unique() if type(row) == str]
                    }
                }
            else:
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'text'
                }
        elif col_type == 'datetime64[ns]':
            # Check if it contains only dates
            if ((df[col_name].dt.floor('d') == df[col_name]) | (df[col_name].isnull())).all():
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'date'
                }
            # Check if it contains only times
            elif ( (df[col_name].dt.date == pd.Timestamp('now').date()) | (df[col_name].isnull()) ).all():
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'time'
                }
            else:
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'datetime'
                }
            
    return json.dumps(queryprops, ensure_ascii=False)
# ---------------- DATA VISUALIZER ----------------
from pandas.api.types import is_datetime64_any_dtype,is_numeric_dtype,is_bool_dtype
def ed_build_colDefs_for_mi_cols(df):
    """
    create columnDefs dict for column grouping
    from multiindex dataframe columns
    """
    # utility
    def get_idx(s, x):
        li_headerName = [e['Header'] for e in s]
        if x not in li_headerName:
            return -1
        else:
            return li_headerName.index(x)

    mindexcol = df.columns
    li_idx_col = mindexcol.tolist()
    s = []
    for levels in li_idx_col:
        col = df.loc[:, levels]
        num_levels = len(levels)
        s2 = s
        flat_field = None
        for k, index_name in enumerate(levels):
            if flat_field:
                # Generate flat field names
                flat_field = str(flat_field) + '_' + str(index_name)
            else:
                flat_field = index_name
            # Upper levels
            if k < num_levels - 1:
                i = get_idx(s2, index_name)
                if i < 0:
                    new_index_name = {'Header': str(index_name),
                             'columns': []}
                    s2.append(new_index_name)
                    i = len(s2) - 1
                s2 = s2[i]['columns']
            # Lowest level
            else:
                flat_field = flat_field.replace('.', '_')
                new_index_name = {'accessor': flat_field,
                         'Header': str(index_name)}
                s2.append(new_index_name)
    return s

def ed_build_colDefs(df, verbose=True):
    colDefs = [{'accessor': str(col).replace('.','_'), 'Header': col} for col in df.columns]
    return colDefs


def ed_flatten_mi_col_df(dfmi):
    """
    create flattend dataframe
    multi index col ('a', 'b', 'c') turned to 'a_b_c'
    """
    df = dfmi.copy()
    cols = df.columns.map(lambda x: '_'.join([str(i) for i in x]))
    df.columns = cols
    return df

def ed_is_multiindex_col_df(df):
    if isinstance(df, pd.core.frame.DataFrame):
        if isinstance(df.columns, pd.core.indexes.multi.MultiIndex):
            return True
    return False

def ed_is_df(data):
    if isinstance(data, pd.core.frame.DataFrame):
        return True
    return False

def ed_is_multiindex_row_df(df):
    if ed_is_df(df):
        if isinstance(df.index, pd.core.indexes.multi.MultiIndex):
            return True
    return False

def ed_check_if_default_index(df):
    # Check if the index is the same as the default index. We use the name as a proxy
    check_index = ((df.index == pd.RangeIndex(start=0,stop=df.shape[0], step=1)).all())
    return check_index

def ed_format_data_for_visualization(df_data):
    for col_name, col in df_data.items():
        if is_datetime64_any_dtype(col):
            # Check if it contains only dates
            if ((df_data[col_name].dt.floor('d') == df_data[col_name]) | (df_data[col_name].isnull())).all():
                df_data[col_name] =  df_data[col_name].dt.strftime('%Y-%m-%d')
            # Check if it contains only times
            #elif ( (df_data[col_name].dt.date == pd.Timestamp('now').date()) | (df_data[col_name].isnull()) ).all():
            #    df_data[col_name] =  df_data[col_name].dt.strftime('%H:%M:%S')
            else:
                df_data[col_name] =  df_data[col_name].dt.strftime('%Y-%m-%d %H:%M:%S')
            
            df_data[col_name] = df_data[col_name].fillna('')
        # Check for bool before numeric, given booleans return tru to is_numeric
        elif is_bool_dtype(col):
            df_data[col_name] = df_data[col_name].astype('str')
        elif is_numeric_dtype(col):
            df_data[col_name] = df_data[col_name].fillna('')
            pass
        else:
            #If not handled, treat as a string
            df_data[col_name] = df_data[col_name].astype('str').replace('nan','')

def ed_prep_data_for_visualization(dfmi,index=False):
    """
    Prepare multiindex dataframe (data) and options
    to display it with corresponding row grouping and
    column grouping
    To do that the dataframe is modified
    + multi index columns are flattened
    + multi index rows are made regular columns
    """

    df_data = dfmi.copy()
    
    # Abreviations: mi is multi index

    # 1. Show only preview of 50 rows, but first get the real size
    n_rows =  df_data.shape[0]
    n_columns =  df_data.shape[1]
    # Handle very wide dataframes
    displayed_columns = n_columns
    if n_columns > 200:
        df_data = df_data.iloc[:,:200]
        displayed_columns = 200
    df_data = df_data.head(50)
    
    # 2. Handle multi-level columns
    # Check it ther are multi-level columns, and generate the column definitions
    if ed_is_multiindex_col_df(df_data):
        # Build multi-level column definitions to be used by the frontend grid
        columnDefs_col = ed_build_colDefs_for_mi_cols(df_data)
        # Create a unique name for each column by composing the names of all the levels
        df_data = ed_flatten_mi_col_df(df_data)
    else:
        columnDefs_col = ed_build_colDefs(df_data)
    
    # 3. Handle multi-index rows
    if ed_is_multiindex_row_df(df_data):
        columnDefs_row = [{'accessor': str(col).replace('.','_'), 'Header': col} for col in list(df_data.index.names)]
        df_data = df_data.reset_index()
    else:
        if 'index' in df_data.columns:
            columnDefs_row = [{'accessor': 'level_0', 'Header': 'pd_index'}]
            df_data = df_data.reset_index()
        else:
            columnDefs_row = [{'accessor': 'index', 'Header': 'index'}]
            df_data = df_data.reset_index()

    # 4. Get the col types before transforming
    names = [col for col in df_data.columns]
    types = [dtype.name for dtype in df_data.dtypes]
    col_types = [{'name': name, 'type': dtype} for name,dtype in zip(names,types)]

    # 5. Ensure data can be read in the frontend
    ed_format_data_for_visualization(df_data)
    # If there are any dots, remove them because react-table can't handle them
    # Only relevatn for single index columns case. 
    df_data.columns = df_data.columns.map(lambda x: str(x).replace('.','_'))
    
    # 6.Prepare output
    # Put together the columns from flattening rows and from flattinging columns
    new_columnDefs = columnDefs_row + columnDefs_col
    
    # 7. Set the json format. 
    df_data = df_data.to_dict(orient='records')
    
    result = {
        'data': df_data, 
        'columns': new_columnDefs,
        'columnTypes': col_types,
        'shape' : {
            'rows': n_rows,
            'columns': n_columns,
            'displayedColumns' : displayed_columns
        }  
    }
    
    # 3. Return as JSON
    return json.dumps(result, ensure_ascii=True, allow_nan=False)
# ---------------- FASTDATA IMPORT ----------------
from fastdata.core import *
`;